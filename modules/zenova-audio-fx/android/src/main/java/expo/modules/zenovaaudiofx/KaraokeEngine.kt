package expo.modules.zenovaaudiofx

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Process
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

// Real-time mic → speaker loopback engine with a small DSP chain
// (gain, telephone/megaphone filters, ring-modulator robot, single-tap
// echo, Schroeder reverb).
//
// Routing: AudioTrack is built with USAGE_MEDIA / CONTENT_TYPE_MUSIC and
// writes to STREAM_MUSIC, which Android routes to the active A2DP sink
// (the Cicada speaker) when one is connected. Backing music from other
// apps (Spotify, YouTube, etc.) also writes to STREAM_MUSIC, so Android
// auto-mixes the two — the user just opens their music app and starts
// singing.
//
// Source: MediaRecorder.AudioSource.MIC (raw mic). We aggressively try
// to DISABLE Android's built-in AcousticEchoCanceler / NoiseSuppressor /
// AutomaticGainControl on this session id, because all of them duck or
// gate the karaoke signal when they detect the speaker output.
class KaraokeEngine {
  companion object {
    const val SAMPLE_RATE = 16000
    const val FRAME_SAMPLES = 320 // 20 ms at 16 kHz
  }

  // ---- DSP parameters (writable from any thread) ----
  @Volatile private var gain: Float = 1.0f
  @Volatile private var reverbMix: Float = 0.0f
  @Volatile private var echoMix: Float = 0.0f
  @Volatile private var echoDelayMs: Int = 350
  @Volatile private var echoFeedback: Float = 0.35f
  @Volatile private var lowpassHz: Float = 0f      // 0 = bypass
  @Volatile private var highpassHz: Float = 0f     // 0 = bypass
  @Volatile private var ringHz: Float = 0f         // 0 = bypass
  @Volatile private var distortion: Float = 0f     // 0..1
  @Volatile private var peakLevel: Float = 0f      // smoothed peak (UI VU)

  // ---- Noise gate (gentle downward expander) to tame speaker/room bleed ----
  // The platform AEC already removes most of the speaker feedback, so this gate
  // is intentionally soft: it ATTENUATES low-level bleed toward a floor rather
  // than fully muting, and opens instantly so word onsets and quiet syllables
  // are never chopped.
  @Volatile private var gateOpenThresh: Float = 0.012f  // RMS above this -> open
  @Volatile private var gateCloseThresh: Float = 0.004f // RMS below this -> floor
  @Volatile private var gateFloor: Float = 0.45f        // min gain when "closed"
  private var gateEnv: Float = 0f      // smoothed input envelope
  private var gateGain: Float = 1f     // current gate gain (floor .. 1 open)

  // ---- Schroeder reverb buffers (4 combs into 2 allpasses) ----
  private val combLens = intArrayOf(421, 451, 487, 521)
  private val combFb = floatArrayOf(0.78f, 0.78f, 0.78f, 0.78f)
  private val combBufs = combLens.map { FloatArray(it) }.toTypedArray()
  private val combIdx = IntArray(combLens.size)

  private val allpassLens = intArrayOf(199, 173)
  private val allpassG = 0.7f
  private val allpassBufs = allpassLens.map { FloatArray(it) }.toTypedArray()
  private val allpassIdx = IntArray(allpassLens.size)

  // ---- Single-tap echo with feedback ----
  private val maxEchoLen = SAMPLE_RATE // 1 second max delay
  private val echoBuf = FloatArray(maxEchoLen)
  private var echoIdx = 0

  // ---- Biquad filter state (Direct Form I) ----
  private var lpB0 = 0f; private var lpB1 = 0f; private var lpB2 = 0f
  private var lpA1 = 0f; private var lpA2 = 0f
  private var lpZ1 = 0f; private var lpZ2 = 0f
  private var lpY1 = 0f; private var lpY2 = 0f
  private var lpCached = -1f

  private var hpB0 = 0f; private var hpB1 = 0f; private var hpB2 = 0f
  private var hpA1 = 0f; private var hpA2 = 0f
  private var hpZ1 = 0f; private var hpZ2 = 0f
  private var hpY1 = 0f; private var hpY2 = 0f
  private var hpCached = -1f

  private var ringPhase = 0.0

  // ---- Lifecycle ----
  @Volatile private var running = false
  private var thread: Thread? = null

  fun start() {
    if (running) return
    running = true
    thread = Thread { loop() }.also { it.name = "KaraokeLoopback"; it.isDaemon = true; it.start() }
  }

  fun stop() {
    running = false
    try { thread?.join(800) } catch (_: Throwable) {}
    thread = null
    // Drop input level immediately so the UI VU returns to zero.
    peakLevel = 0f
  }

  fun isRunning(): Boolean = running

  fun setGain(v: Float) { gain = v.coerceIn(0f, 4f) }
  fun setReverbMix(v: Float) { reverbMix = v.coerceIn(0f, 1f) }
  fun setEcho(mix: Float, delayMs: Int, feedback: Float) {
    echoMix = mix.coerceIn(0f, 1f)
    echoDelayMs = delayMs.coerceIn(20, 1000)
    echoFeedback = feedback.coerceIn(0f, 0.95f)
  }
  fun setLowpassHz(v: Float) { lowpassHz = v.coerceAtLeast(0f) }
  fun setHighpassHz(v: Float) { highpassHz = v.coerceAtLeast(0f) }
  fun setRingHz(v: Float) { ringHz = v.coerceAtLeast(0f) }
  fun setDistortion(v: Float) { distortion = v.coerceIn(0f, 1f) }

  fun getLevel(): Float = peakLevel

  // ----------------------------------------------------------------
  // Audio loop. Runs on its own thread at THREAD_PRIORITY_URGENT_AUDIO.
  // ----------------------------------------------------------------
  private fun loop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)

    val minRecBytes = AudioRecord.getMinBufferSize(
      SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
    )
    val recBufBytes = max(minRecBytes, FRAME_SAMPLES * 2 * 4)

    // Prefer VOICE_COMMUNICATION: it engages the platform's playback-referenced
    // acoustic echo canceller, which is the only reliable way to stop the mic
    // from re-capturing the speaker output (the cause of the echo/feedback).
    // Fall back to raw MIC only if that source can't be opened.
    var usedVoiceComm = true
    var record = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_COMMUNICATION,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        recBufBytes,
      )
    } catch (_: Throwable) {
      null
    }
    if (record == null || record.state != AudioRecord.STATE_INITIALIZED) {
      try { record?.release() } catch (_: Throwable) {}
      usedVoiceComm = false
      record = try {
        AudioRecord(
          MediaRecorder.AudioSource.MIC,
          SAMPLE_RATE,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT,
          recBufBytes,
        )
      } catch (_: Throwable) {
        running = false; return
      }
    }
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      try { record.release() } catch (_: Throwable) {}
      running = false; return
    }

    // Enable Android's built-in mic processing so the speaker output the mic
    // re-captures is cancelled/suppressed instead of being amplified back out.
    // (AGC stays off — it pumps the karaoke level.)
    try {
      if (AcousticEchoCanceler.isAvailable())
        AcousticEchoCanceler.create(record.audioSessionId)?.enabled = true
    } catch (_: Throwable) {}
    try {
      if (NoiseSuppressor.isAvailable())
        NoiseSuppressor.create(record.audioSessionId)?.enabled = true
    } catch (_: Throwable) {}
    try {
      if (AutomaticGainControl.isAvailable())
        AutomaticGainControl.create(record.audioSessionId)?.enabled = false
    } catch (_: Throwable) {}

    // When the platform AEC (VOICE_COMMUNICATION) is engaged most bleed is
    // already removed, so the gate barely has to work and keeps a high floor so
    // the voice is never cut. On the raw-MIC fallback there is no echo
    // cancellation, so attenuate harder (lower floor) to suppress feedback.
    if (usedVoiceComm) {
      gateOpenThresh = 0.012f; gateCloseThresh = 0.004f; gateFloor = 0.55f
    } else {
      gateOpenThresh = 0.020f; gateCloseThresh = 0.009f; gateFloor = 0.30f
    }
    gateEnv = 0f
    gateGain = 1f

    val minTrkBytes = AudioTrack.getMinBufferSize(
      SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
    )
    val trkBufBytes = max(minTrkBytes, FRAME_SAMPLES * 2 * 4)

    val track = try {
      AudioTrack.Builder()
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .setFlags(AudioAttributes.FLAG_LOW_LATENCY)
            .build(),
        )
        .setAudioFormat(
          AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build(),
        )
        .setBufferSizeInBytes(trkBufBytes)
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()
    } catch (_: Throwable) {
      try { record.release() } catch (_: Throwable) {}
      running = false; return
    }

    try {
      record.startRecording()
      track.play()
    } catch (_: Throwable) {
      try { record.release() } catch (_: Throwable) {}
      try { track.release() } catch (_: Throwable) {}
      running = false; return
    }

    val inBuf = ShortArray(FRAME_SAMPLES)
    val outBuf = ShortArray(FRAME_SAMPLES)
    val work = FloatArray(FRAME_SAMPLES)
    val reverbIn = FloatArray(FRAME_SAMPLES)

    while (running) {
      val read = try { record.read(inBuf, 0, FRAME_SAMPLES) } catch (_: Throwable) { -1 }
      if (read <= 0) continue

      // Refresh biquad coefficients only when the cutoff actually changes.
      val lpHz = lowpassHz
      if (lpHz != lpCached) { lpCached = lpHz; computeLPCoefs(lpHz) }
      val hpHz = highpassHz
      if (hpHz != hpCached) { hpCached = hpHz; computeHPCoefs(hpHz) }

      // Sample-wise DSP for pre-reverb stages.
      val g = gain
      val rHz = ringHz
      val dist = distortion
      val gOpen = gateOpenThresh
      val gClose = gateCloseThresh
      val gFloor = gateFloor
      var peak = 0f
      for (i in 0 until read) {
        var x = (inBuf[i].toFloat()) / 32768f

        // Soft noise gate: follow the raw input envelope; open instantly when
        // the singer rises above the open threshold, and ease down only to the
        // floor (not silence) when it drops below the close threshold. Because
        // it never fully closes and opens instantly, the voice is preserved
        // while steady low-level bleed is gently attenuated.
        val ax = if (x >= 0f) x else -x
        gateEnv = if (ax > gateEnv) (gateEnv * 0.4f + ax * 0.6f) else (gateEnv * 0.96f + ax * 0.04f)
        val gateTarget = if (gateEnv >= gOpen) 1f else if (gateEnv <= gClose) gFloor else gateGain
        // Instant attack (open), slow release (toward floor) to avoid choppy gating.
        gateGain = if (gateTarget >= gateGain) gateTarget
                   else (gateGain * 0.92f + gateTarget * 0.08f)
        x *= gateGain

        x *= g

        if (rHz > 0f) {
          ringPhase += 2.0 * PI * rHz / SAMPLE_RATE
          if (ringPhase > 2.0 * PI) ringPhase -= 2.0 * PI
          x *= sin(ringPhase).toFloat()
        }

        if (dist > 0.001f) {
          val k = 1f + 19f * dist
          x = tanhApprox((x * k).coerceIn(-3f, 3f))
        }

        if (hpCached > 0f) {
          val y = hpB0 * x + hpB1 * hpZ1 + hpB2 * hpZ2 - hpA1 * hpY1 - hpA2 * hpY2
          hpZ2 = hpZ1; hpZ1 = x; hpY2 = hpY1; hpY1 = y
          x = y
        }
        if (lpCached > 0f) {
          val y = lpB0 * x + lpB1 * lpZ1 + lpB2 * lpZ2 - lpA1 * lpY1 - lpA2 * lpY2
          lpZ2 = lpZ1; lpZ1 = x; lpY2 = lpY1; lpY1 = y
          x = y
        }

        work[i] = x
        reverbIn[i] = x

        val a = if (x >= 0f) x else -x
        if (a > peak) peak = a
      }

      // Single-tap echo with feedback.
      val em = echoMix
      if (em > 0.001f) {
        val delaySamples = (echoDelayMs * SAMPLE_RATE / 1000).coerceIn(20, maxEchoLen - 1)
        val fb = echoFeedback
        for (i in 0 until read) {
          val readIdx = (echoIdx - delaySamples + maxEchoLen) % maxEchoLen
          val tap = echoBuf[readIdx]
          echoBuf[echoIdx] = work[i] + tap * fb
          echoIdx = (echoIdx + 1) % maxEchoLen
          work[i] = work[i] + tap * em
        }
      }

      // Schroeder reverb tail.
      val rm = reverbMix
      if (rm > 0.001f) {
        for (i in 0 until read) {
          val dry = reverbIn[i]
          var sum = 0f
          for (c in combBufs.indices) {
            val buf = combBufs[c]
            val len = combLens[c]
            var idx = combIdx[c]
            val out = buf[idx]
            buf[idx] = dry + combFb[c] * out
            idx++; if (idx >= len) idx = 0
            combIdx[c] = idx
            sum += out
          }
          sum *= 0.25f
          for (a in allpassBufs.indices) {
            val buf = allpassBufs[a]
            val len = allpassLens[a]
            var idx = allpassIdx[a]
            val out = buf[idx]
            val newVal = sum + allpassG * out
            buf[idx] = newVal
            idx++; if (idx >= len) idx = 0
            allpassIdx[a] = idx
            sum = out - allpassG * newVal
          }
          work[i] = work[i] * (1f - rm) + sum * rm * 1.4f
        }
      }

      // Convert back to PCM16.
      for (i in 0 until read) {
        var y = work[i] * 32767f
        if (y > 32767f) y = 32767f
        if (y < -32768f) y = -32768f
        outBuf[i] = y.toInt().toShort()
      }

      // VU meter — fast attack, slow release.
      peakLevel = if (peak > peakLevel) (peakLevel * 0.3f + peak * 0.7f) else (peakLevel * 0.94f)

      try { track.write(outBuf, 0, read) } catch (_: Throwable) { break }
    }

    try { record.stop() } catch (_: Throwable) {}
    try { record.release() } catch (_: Throwable) {}
    try { track.stop() } catch (_: Throwable) {}
    try { track.release() } catch (_: Throwable) {}
  }

  // Padé tanh — cheap soft clip for the distortion stage.
  private fun tanhApprox(x: Float): Float {
    val x2 = x * x
    return x * (27f + x2) / (27f + 9f * x2)
  }

  private fun computeLPCoefs(hz: Float) {
    if (hz <= 0f) return
    val q = 0.707
    val w = 2.0 * PI * hz / SAMPLE_RATE
    val alpha = sin(w) / (2.0 * q)
    val cw = cos(w)
    val b0 = (1.0 - cw) / 2.0
    val b1 = 1.0 - cw
    val b2 = (1.0 - cw) / 2.0
    val a0 = 1.0 + alpha
    val a1 = -2.0 * cw
    val a2 = 1.0 - alpha
    lpB0 = (b0 / a0).toFloat(); lpB1 = (b1 / a0).toFloat(); lpB2 = (b2 / a0).toFloat()
    lpA1 = (a1 / a0).toFloat(); lpA2 = (a2 / a0).toFloat()
    lpZ1 = 0f; lpZ2 = 0f; lpY1 = 0f; lpY2 = 0f
  }

  private fun computeHPCoefs(hz: Float) {
    if (hz <= 0f) return
    val q = 0.707
    val w = 2.0 * PI * hz / SAMPLE_RATE
    val alpha = sin(w) / (2.0 * q)
    val cw = cos(w)
    val b0 = (1.0 + cw) / 2.0
    val b1 = -(1.0 + cw)
    val b2 = (1.0 + cw) / 2.0
    val a0 = 1.0 + alpha
    val a1 = -2.0 * cw
    val a2 = 1.0 - alpha
    hpB0 = (b0 / a0).toFloat(); hpB1 = (b1 / a0).toFloat(); hpB2 = (b2 / a0).toFloat()
    hpA1 = (a1 / a0).toFloat(); hpA2 = (a2 / a0).toFloat()
    hpZ1 = 0f; hpZ2 = 0f; hpY1 = 0f; hpY2 = 0f
  }
}
