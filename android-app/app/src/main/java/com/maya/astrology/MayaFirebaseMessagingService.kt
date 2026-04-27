package com.maya.astrology

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MayaFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "MayaFirebaseMsg"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        FcmTokenStore.saveToken(this, token)
        Log.d(TAG, "FCM token refreshed")
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title
            ?: message.data["title"]
            ?: getString(R.string.app_name)
        val body = message.notification?.body
            ?: message.data["body"]
            ?: message.data["message"]
            ?: return
        val destinationUrl = message.data["url"]
            ?: message.data["deep_link"]
            ?: message.data["path"]

        showNotification(title, body, destinationUrl)
    }

    private fun showNotification(title: String, body: String, destinationUrl: String?) {
        MayaPushNotifications.ensureChannel(this)

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MayaPushNotifications.EXTRA_NOTIFICATION_URL, destinationUrl)
            putExtra(MayaPushNotifications.EXTRA_NOTIFICATION_TITLE, title)
            putExtra(MayaPushNotifications.EXTRA_NOTIFICATION_BODY, body)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            destinationUrl?.hashCode() ?: System.currentTimeMillis().toInt(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, MayaPushNotifications.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setColor(ContextCompat.getColor(this, R.color.maya_primary))
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Skipping notification because POST_NOTIFICATIONS is not granted")
            return
        }

        NotificationManagerCompat.from(this).notify(
            destinationUrl?.hashCode() ?: body.hashCode(),
            notification
        )
    }
}