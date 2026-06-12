package expo.modules.zenovaaudiofx

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ZenovaAudioFxService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Zenova EQ",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Keeps the system equaliser active when Zenova is in the background."
        setShowBadge(false)
      }
      nm.createNotificationChannel(channel)
    }

    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Zenova EQ is on")
      .setContentText("Shaping system audio in the background")
      .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Sticky so Android relaunches the service if the system tears it down.
    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
  }

  companion object {
    const val CHANNEL_ID = "zenova_audio_fx"
    const val NOTIFICATION_ID = 4711
  }
}
