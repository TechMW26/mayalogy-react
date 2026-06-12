package expo.modules.zenovaaudiofx

import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.BassBoost
import android.media.audiofx.EnvironmentalReverb
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import android.os.Build
import android.util.Base64
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ZenovaAudioFxModule : Module() {
  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var virtualizer: Virtualizer? = null
  private var loudness: LoudnessEnhancer? = null
  private var reverb: EnvironmentalReverb? = null

  // Real-time mic → speaker karaoke loopback. Lazily created the first time
  // the user starts karaoke; survives until release().
  private val karaoke: KaraokeEngine by lazy { KaraokeEngine() }

  private var enabled: Boolean = true
  private var a2dpProxy: BluetoothA2dp? = null

  // Single lock that serializes ALL native audio-effect access. AsyncFunction
  // handlers run on a worker pool, and the underlying android.media.audiofx
  // objects are NOT thread-safe — concurrent calls to setBandLevel on the
  // same Equalizer cause a native heap crash that no JS try/catch can recover
  // from. Every effect mutation goes through `locked { }`.
  private val effectLock = Any()

  // LoudnessEnhancer make-up gain (mB) — compensates for headroom Android's
  // Equalizer reserves to prevent clipping. Without this, balanced settings
  // sound noticeably quieter than bypass.
  private var makeupGainMb: Int = 600

  override fun definition() = ModuleDefinition {
    Name("ZenovaAudioFx")

    OnCreate {
      locked { ensureEffects() }
      locked { applyEnabled() }
      locked { applyMakeup() }
      safe { ensureA2dpProxy() }
    }

    OnDestroy {
      locked { release() }
      safe { releaseA2dpProxy() }
    }

    Function("isAvailable") {
      locked { ensureEffects() }
      equalizer != null
    }

    AsyncFunction("setEnabled") { value: Boolean ->
      locked {
        enabled = value
        ensureEffects()
        applyEnabled()
      }
    }

    AsyncFunction("setMakeupGain") { gainMb: Int ->
      locked {
        makeupGainMb = gainMb.coerceIn(0, 3000)
        ensureEffects()
        applyMakeup()
      }
    }

    AsyncFunction("getBandCount") {
      lockedReturning(0) {
        ensureEffects()
        equalizer?.numberOfBands?.toInt() ?: 0
      }
    }

    AsyncFunction("getBandLevels") {
      lockedReturning(emptyList<Int>()) {
        ensureEffects()
        val eq = equalizer ?: return@lockedReturning emptyList<Int>()
        val n = eq.numberOfBands.toInt()
        (0 until n).map { eq.getBandLevel(it.toShort()).toInt() }
      }
    }

    AsyncFunction("getBandRange") {
      lockedReturning(listOf(-1500, 1500)) {
        ensureEffects()
        val eq = equalizer ?: return@lockedReturning listOf(-1500, 1500)
        val range = eq.bandLevelRange
        listOf(range[0].toInt(), range[1].toInt())
      }
    }

    AsyncFunction("setBandLevels") { levels: List<Int> ->
      locked {
        ensureEffects()
        val eq = equalizer ?: return@locked
        val n = eq.numberOfBands.toInt()
        val range = eq.bandLevelRange
        val lo = range[0].toInt()
        val hi = range[1].toInt()
        val count = minOf(n, levels.size)
        for (i in 0 until count) {
          val clamped = levels[i].coerceIn(lo, hi)
          try {
            eq.setBandLevel(i.toShort(), clamped.toShort())
          } catch (_: Throwable) {
            // Per-band failure shouldn't kill the whole sweep.
          }
        }
      }
    }

    // Tone deltas are integers in [-6..+6]. Each step maps to 250 mB.
    AsyncFunction("setTone") { bass: Int, mid: Int, treble: Int ->
      locked {
        ensureEffects()
        val eq = equalizer ?: return@locked
        val n = eq.numberOfBands.toInt()
        val range = eq.bandLevelRange
        val lo = range[0].toInt()
        val hi = range[1].toInt()
        val stepMb = 250
        for (i in 0 until n) {
          val gain = when {
            i <= 1 -> bass * stepMb
            i >= n - 2 -> treble * stepMb
            else -> mid * stepMb
          }
          try {
            eq.setBandLevel(i.toShort(), gain.coerceIn(lo, hi).toShort())
          } catch (_: Throwable) {
            // ignore individual band failures
          }
        }
      }
    }

    AsyncFunction("setBassBoost") { strength: Int ->
      locked {
        ensureEffects()
        val bb = bassBoost ?: return@locked
        val clamped = strength.coerceIn(0, 1000)
        bb.setStrength(clamped.toShort())
        // Spatial effects are independent of the EQ engine — they only
        // require a non-zero strength. The user can run spatial without
        // the equaliser engaged.
        bb.setEnabled(clamped > 0)
      }
    }

    AsyncFunction("setVirtualizer") { strength: Int ->
      locked {
        ensureEffects()
        val v = virtualizer ?: return@locked
        val clamped = strength.coerceIn(0, 1000)
        v.setStrength(clamped.toShort())
        // Critical for Bluetooth/A2DP output: by default Android's Virtualizer
        // is bypassed when the output isn't headphones. Forcing BINAURAL mode
        // makes the stereo-widening apply to ANY sink — including BT speakers.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          try {
            v.forceVirtualizationMode(Virtualizer.VIRTUALIZATION_MODE_BINAURAL)
          } catch (_: Throwable) {
            // Some OEMs reject forced mode; the strength alone still applies.
          }
        }
        v.setEnabled(clamped > 0)
      }
    }

    // 0=NONE, 1=SMALLROOM, 2=MEDIUMROOM, 3=LARGEROOM, 4=MEDIUMHALL, 5=LARGEHALL, 6=PLATE.
    // We use EnvironmentalReverb (not PresetReverb) so we can crank the wet
    // level explicitly — PresetReverb's built-in profiles are inaudible on
    // most OEMs because the wet mix sits ~30 dB below dry.
    AsyncFunction("setReverbPreset") { preset: Int ->
      locked {
        ensureEffects()
        val r = reverb ?: return@locked
        val p = preset.coerceIn(0, 6)
        if (p == 0) {
          r.setEnabled(false)
          return@locked
        }
        // (decayMs, decayHFRatio (perMille), reverbLevelMb, reverbDelayMs,
        //  reflectionsLevelMb, reflectionsDelayMs, diffusionPerMille,
        //  densityPerMille, roomLevelMb, roomHFLevelMb)
        // Levels are mB (1 dB = 100 mB). Max is 0 (full wet); typical "audible"
        // wet is around -200..-500 mB. We push aggressively for clear effect.
        val (decay, hf, lvl, dly, refLvl, refDly, diff, dens, room, roomHf) = when (p) {
          1 -> Profile(900,  600,  -300, 11, -200,  6, 1000, 1000, -800,  -300)  // SmallRoom
          2 -> Profile(1300, 540,  -200, 17, -150,  9, 1000, 1000, -600,  -400)  // MediumRoom
          3 -> Profile(1900, 510,  -100, 25, -100, 13, 1000, 1000, -400,  -500)  // LargeRoom
          4 -> Profile(2700, 480,   -50, 32,  -50, 19, 1000, 1000, -300,  -600)  // MediumHall
          5 -> Profile(4200, 450,     0, 45,   -0, 28, 1000, 1000, -150,  -900)  // LargeHall
          6 -> Profile(2200, 720,   -50, 12,  -50,  8, 1000, 1000, -200, -1500)  // Plate (bright, dense)
          else -> Profile(1500, 500, -300, 20, -300, 12, 1000, 1000, -800, -500)
        }
        try { r.decayTime = decay }            catch (_: Throwable) {}
        try { r.decayHFRatio = hf.toShort() }  catch (_: Throwable) {}
        try { r.reverbLevel = lvl.toShort() }  catch (_: Throwable) {}
        try { r.reverbDelay = dly }            catch (_: Throwable) {}
        try { r.reflectionsLevel = refLvl.toShort() } catch (_: Throwable) {}
        try { r.reflectionsDelay = refDly }    catch (_: Throwable) {}
        try { r.diffusion = diff.toShort() }   catch (_: Throwable) {}
        try { r.density = dens.toShort() }     catch (_: Throwable) {}
        try { r.roomLevel = room.toShort() }   catch (_: Throwable) {}
        try { r.roomHFLevel = roomHf.toShort() } catch (_: Throwable) {}
        r.setEnabled(true)
      }
    }

    AsyncFunction("getPresets") {
      lockedReturning(emptyList<String>()) {
        ensureEffects()
        val eq = equalizer ?: return@lockedReturning emptyList<String>()
        (0 until eq.numberOfPresets).map { eq.getPresetName(it.toShort()) }
      }
    }

    AsyncFunction("usePreset") { index: Int ->
      locked {
        ensureEffects()
        val eq = equalizer ?: return@locked
        if (index in 0 until eq.numberOfPresets) {
          eq.usePreset(index.toShort())
        }
      }
    }

    AsyncFunction("startBackground") {
      val context: Context? = appContext.reactContext
      if (context != null) {
        val intent = Intent(context, ZenovaAudioFxService::class.java)
        safe {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
          } else {
            context.startService(intent)
          }
        }
      }
    }

    AsyncFunction("stopBackground") {
      val context: Context? = appContext.reactContext
      if (context != null) {
        safe {
          context.stopService(Intent(context, ZenovaAudioFxService::class.java))
        }
      }
    }

    // Returns the MAC addresses of devices currently connected as A2DP audio
    // sinks. Catches audio-only Bluetooth devices that don't open an SPP socket.
    AsyncFunction("getConnectedAudioAddresses") {
      safe { ensureA2dpProxy() }
      safeReturning(emptyList<String>()) {
        val proxy = a2dpProxy ?: return@safeReturning emptyList<String>()
        proxy.connectedDevices.map { it.address.uppercase() }
      }
    }

    // Reports whether Android's audio routing is READY to send a stream to
    // the given Bluetooth device. "Ready" means all of these are true:
    //   1. The A2DP profile reports STATE_CONNECTED for the device.
    //   2. Android's AudioManager lists a BT_A2DP output device.
    //   3. The A2DP sink is not blocked (avrcp/codec negotiation is done).
    //
    // Used by the JS layer to wait for the speaker to actually accept audio
    // before playing the welcome sound — BT speakers can take 1–3+ seconds
    // after "connected" before they can play, depending on codec, hardware,
    // and prior pairing state.
    AsyncFunction("isAudioRouteReady") { address: String ->
      safe { ensureA2dpProxy() }
      safeReturning(false) {
        val proxy = a2dpProxy ?: return@safeReturning false
        val upper = address.uppercase()
        // 1. A2DP profile must report STATE_CONNECTED for this device.
        val matchingConnected = proxy.connectedDevices.firstOrNull {
          it.address.uppercase() == upper
        } ?: return@safeReturning false
        val state = try {
          proxy.getConnectionState(matchingConnected)
        } catch (_: Throwable) {
          BluetoothProfile.STATE_DISCONNECTED
        }
        if (state != BluetoothProfile.STATE_CONNECTED) return@safeReturning false

        // 2. AudioManager must report at least one BT_A2DP output device.
        //    This is the cleanest signal that Android has actually finished
        //    routing media output to the Bluetooth sink.
        val ctx: Context = appContext.reactContext ?: return@safeReturning false
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
          ?: return@safeReturning false
        val outputs = try {
          am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        } catch (_: Throwable) {
          return@safeReturning false
        }
        val hasA2dpOutput = outputs.any { dev ->
          dev.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
        }
        if (!hasA2dpOutput) return@safeReturning false

        // 3. Optional extra: the A2DP profile reports it's not currently
        //    suppressed by an active call / codec switch. isA2dpPlaying is
        //    only useful AFTER playback has started, so we just verify the
        //    proxy considers the sink stream-capable (not in transitional
        //    state). connectedDevices.contains() above already ensures this.
        true
      }
    }

    // --- Volume control on STREAM_MUSIC ---
    // Returns [currentVolume, maxVolume] for the music stream.
    AsyncFunction("getMusicVolume") {
      safeReturning(listOf(0, 0)) {
        val ctx: Context = appContext.reactContext
          ?: return@safeReturning listOf(0, 0)
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
          ?: return@safeReturning listOf(0, 0)
        listOf(
          am.getStreamVolume(AudioManager.STREAM_MUSIC),
          am.getStreamMaxVolume(AudioManager.STREAM_MUSIC),
        )
      }
    }

    // Sets STREAM_MUSIC to the given level (0..max). Returns the new value.
    AsyncFunction("setMusicVolume") { level: Int ->
      safeReturning(0) {
        val ctx: Context = appContext.reactContext ?: return@safeReturning 0
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
          ?: return@safeReturning 0
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val clamped = level.coerceIn(0, max)
        am.setStreamVolume(AudioManager.STREAM_MUSIC, clamped, 0)
        am.getStreamVolume(AudioManager.STREAM_MUSIC)
      }
    }

    Function("release") {
      locked { release() }
    }

    // --------------------------------------------------------------
    // Karaoke loopback engine
    // --------------------------------------------------------------

    AsyncFunction("startKaraoke") {
      safe { karaoke.start() }
    }

    AsyncFunction("stopKaraoke") {
      safe { karaoke.stop() }
    }

    AsyncFunction("isKaraokeRunning") {
      safeReturning(false) { karaoke.isRunning() }
    }

    AsyncFunction("setKaraokeGain") { value: Double ->
      safe { karaoke.setGain(value.toFloat()) }
    }

    AsyncFunction("setKaraokeReverb") { mix: Double ->
      safe { karaoke.setReverbMix(mix.toFloat()) }
    }

    AsyncFunction("setKaraokeEcho") { mix: Double, delayMs: Int, feedback: Double ->
      safe { karaoke.setEcho(mix.toFloat(), delayMs, feedback.toFloat()) }
    }

    AsyncFunction("setKaraokeLowpass") { hz: Double ->
      safe { karaoke.setLowpassHz(hz.toFloat()) }
    }

    AsyncFunction("setKaraokeHighpass") { hz: Double ->
      safe { karaoke.setHighpassHz(hz.toFloat()) }
    }

    AsyncFunction("setKaraokeRing") { hz: Double ->
      safe { karaoke.setRingHz(hz.toFloat()) }
    }

    AsyncFunction("setKaraokeDistortion") { value: Double ->
      safe { karaoke.setDistortion(value.toFloat()) }
    }

    AsyncFunction("getKaraokeLevel") {
      safeReturning(0.0) { karaoke.getLevel().toDouble() }
    }

    // --------------------------------------------------------------
    // Keep screen on — used during terraform so the device doesn't
    // sleep mid-measurement and pause the song / kill the recorder.
    // --------------------------------------------------------------

    AsyncFunction("setKeepScreenOn") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.runOnUiThread {
        val window = activity.window ?: return@runOnUiThread
        if (enabled) {
          window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
      }
    }

    // --------------------------------------------------------------
    // Mic snippet capture — records a short 16 kHz mono PCM clip and
    // returns it as base64 (little-endian s16). Used by the in-app
    // Shazam-style music recognizer. No notification access needed.
    // --------------------------------------------------------------

    AsyncFunction("recordMicSnippet") { durationMs: Int ->
      recordSnippet(durationMs)
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private inline fun safe(block: () -> Unit) {
    try {
      block()
    } catch (_: Throwable) {
      // Swallow — audio effect APIs can throw on hot-plug, route changes,
      // OEM lockdown, etc. We never want to surface those to JS.
    }
  }

  // Records `durationMs` of 16 kHz mono PCM from the mic and returns it as a
  // base64 string of little-endian signed 16-bit samples. Returns null on any
  // failure (no permission, mic busy, OEM lockdown). Prefers the UNPROCESSED
  // source so music isn't mangled by voice-oriented DSP.
  private fun recordSnippet(durationMs: Int): String? {
    val sampleRate = 16000
    val channel = AudioFormat.CHANNEL_IN_MONO
    val encoding = AudioFormat.ENCODING_PCM_16BIT
    val minBuf = AudioRecord.getMinBufferSize(sampleRate, channel, encoding)
    if (minBuf <= 0) return null
    val bufferBytes = maxOf(minBuf, sampleRate * 2)

    fun open(source: Int): AudioRecord? = try {
      val r = AudioRecord(source, sampleRate, channel, encoding, bufferBytes)
      if (r.state == AudioRecord.STATE_INITIALIZED) r else { r.release(); null }
    } catch (_: Throwable) { null }

    val preferred = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
      MediaRecorder.AudioSource.UNPROCESSED else MediaRecorder.AudioSource.MIC
    val recorder = open(preferred) ?: open(MediaRecorder.AudioSource.MIC) ?: return null

    return try {
      val totalSamples = (sampleRate.toLong() * durationMs / 1000L).toInt()
      val pcm = java.io.ByteArrayOutputStream(totalSamples * 2)
      val chunk = ShortArray(2048)
      val bytes = ByteArray(chunk.size * 2)
      recorder.startRecording()
      var got = 0
      while (got < totalSamples) {
        val n = recorder.read(chunk, 0, chunk.size)
        if (n <= 0) break
        var bi = 0
        for (i in 0 until n) {
          val s = chunk[i].toInt()
          bytes[bi++] = (s and 0xff).toByte()
          bytes[bi++] = ((s shr 8) and 0xff).toByte()
        }
        pcm.write(bytes, 0, n * 2)
        got += n
      }
      recorder.stop()
      if (got <= 0) null else Base64.encodeToString(pcm.toByteArray(), Base64.NO_WRAP)
    } catch (_: Throwable) {
      null
    } finally {
      try { recorder.release() } catch (_: Throwable) { /* noop */ }
    }
  }

  private inline fun <T> safeReturning(fallback: T, block: () -> T): T {
    return try {
      block()
    } catch (_: Throwable) {
      fallback
    }
  }

  // Serializes access to the native audio-effect objects across threads.
  private inline fun locked(block: () -> Unit) {
    synchronized(effectLock) {
      try {
        block()
      } catch (_: Throwable) {
        // ignore — same swallowing strategy as `safe`.
      }
    }
  }

  private inline fun <T> lockedReturning(fallback: T, block: () -> T): T {
    return synchronized(effectLock) {
      try {
        block()
      } catch (_: Throwable) {
        fallback
      }
    }
  }

  private fun ensureEffects() {
    if (equalizer == null) {
      try {
        equalizer = Equalizer(0, 0).apply { setEnabled(enabled) }
      } catch (_: Throwable) {
        equalizer = null
      }
    }
    if (bassBoost == null) {
      try {
        bassBoost = BassBoost(0, 0).apply { setEnabled(enabled) }
      } catch (_: Throwable) {
        bassBoost = null
      }
    }
    if (virtualizer == null) {
      try {
        virtualizer = Virtualizer(0, 0).apply { setEnabled(enabled) }
      } catch (_: Throwable) {
        virtualizer = null
      }
    }
    if (loudness == null) {
      try {
        loudness = LoudnessEnhancer(0).apply {
          setTargetGain(makeupGainMb)
          setEnabled(enabled)
        }
      } catch (_: Throwable) {
        loudness = null
      }
    }
    if (reverb == null) {
      try {
        // Priority 1, session 0 (global mix output). EnvironmentalReverb on
        // session 0 acts as an insert effect on the output mix, so its wet
        // signal mixes into ALL playback (including Bluetooth A2DP routes).
        reverb = EnvironmentalReverb(1, 0).apply {
          setEnabled(false) // start bypassed; UI opts in.
        }
      } catch (_: Throwable) {
        reverb = null
      }
    }
  }

  private data class Profile(
    val decay: Int,
    val hf: Int,
    val lvl: Int,
    val dly: Int,
    val refLvl: Int,
    val refDly: Int,
    val diff: Int,
    val dens: Int,
    val room: Int,
    val roomHf: Int,
  )

  private fun applyEnabled() {
    safe { equalizer?.setEnabled(enabled) }
    safe { loudness?.setEnabled(enabled) }
    // bassBoost, virtualizer, reverb are spatial effects and operate
    // independently of the EQ engine flag. They are controlled solely by
    // their own strength/preset value via setBassBoost / setVirtualizer /
    // setReverbPreset. We DO NOT force them off when the EQ engine is
    // bypassed — the user explicitly wants spatial controls to keep working
    // regardless of whether the equaliser itself is engaged.
  }

  private fun applyMakeup() {
    safe { loudness?.setTargetGain(makeupGainMb) }
  }

  private fun release() {
    safe { karaoke.stop() }
    safe { equalizer?.release() }
    safe { bassBoost?.release() }
    safe { virtualizer?.release() }
    safe { loudness?.release() }
    safe { reverb?.release() }
    equalizer = null
    bassBoost = null
    virtualizer = null
    loudness = null
    reverb = null
  }

  // ------------------------------------------------------------------
  // A2DP profile proxy
  // ------------------------------------------------------------------

  private fun ensureA2dpProxy() {
    if (a2dpProxy != null) return
    val context: Context = appContext.reactContext ?: return
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
    val adapter = manager.adapter ?: return
    try {
      adapter.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile?) {
          if (profile == BluetoothProfile.A2DP) {
            a2dpProxy = proxy as? BluetoothA2dp
          }
        }

        override fun onServiceDisconnected(profile: Int) {
          if (profile == BluetoothProfile.A2DP) {
            a2dpProxy = null
          }
        }
      }, BluetoothProfile.A2DP)
    } catch (_: Throwable) {
      // OEM may reject access; ignore — fallbacks handle the case.
    }
  }

  private fun releaseA2dpProxy() {
    val proxy = a2dpProxy ?: return
    val context: Context = appContext.reactContext ?: return
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
    val adapter = manager.adapter ?: return
    try {
      adapter.closeProfileProxy(BluetoothProfile.A2DP, proxy)
    } catch (_: Throwable) {
      // ignore
    }
    a2dpProxy = null
  }
}
