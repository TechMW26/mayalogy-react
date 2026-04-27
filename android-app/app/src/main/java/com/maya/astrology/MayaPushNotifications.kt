package com.maya.astrology

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

object MayaPushNotifications {
    const val CHANNEL_ID = "maya_push_notifications"
    const val EXTRA_NOTIFICATION_URL = "notification_url"
    const val EXTRA_NOTIFICATION_TITLE = "notification_title"
    const val EXTRA_NOTIFICATION_BODY = "notification_body"

    private const val CHANNEL_NAME = "Mayalogy Notifications"
    private const val CHANNEL_DESCRIPTION = "Astrology updates, reminders, and alerts"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = CHANNEL_DESCRIPTION
        }
        manager.createNotificationChannel(channel)
    }
}