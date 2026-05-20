package com.pocketlan.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PocketLanService extends Service {
    static final String ACTION_START = "com.pocketlan.android.START";
    static final String ACTION_STOP = "com.pocketlan.android.STOP";
    static final String EXTRA_TREE_URI = "treeUri";
    static final String EXTRA_PORT = "port";
    static final String EXTRA_CUSTOM_IP = "customIp";
    static final String EXTRA_PIN = "pin";
    static final String PREFS = "pocketlan";
    static final String KEY_TREE_URI = "treeUri";
    static final String KEY_PORT = "port";
    static final String KEY_CUSTOM_IP = "customIp";
    static final String KEY_PIN = "pin";
    private static final String KEY_SERVER_ACTIVE = "serverActive";
    private static final String CHANNEL_ID = "pocketlan_sharing";
    private static final int NOTIFICATION_ID = 42;
    private static final int MAX_LOGS = 120;
    private static final Object LOCK = new Object();

    private static AndroidFileServer server;
    private static State state = State.stopped();
    private static final List<String> logs = new ArrayList<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    static State currentState() {
        synchronized (LOCK) {
            return state.copy(new ArrayList<>(logs));
        }
    }

    static void addLog(String message) {
        synchronized (LOCK) {
            String time = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
            logs.add("[" + time + "] " + message);
            while (logs.size() > MAX_LOGS) {
                logs.remove(0);
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? "" : intent.getAction();
        if (ACTION_START.equals(action)) {
            String treeUri = intent.getStringExtra(EXTRA_TREE_URI);
            int port = intent.getIntExtra(EXTRA_PORT, 3000);
            String customIp = intent.getStringExtra(EXTRA_CUSTOM_IP);
            String pin = intent.getStringExtra(EXTRA_PIN);
            persistActiveConfig(treeUri, port, customIp, pin);
            startForeground(NOTIFICATION_ID, buildNotification("Starting on port " + port, port, customIp));
            startServer(treeUri, port, customIp, pin);
            return START_STICKY;
        }

        if (ACTION_STOP.equals(action)) {
            stopServer(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (resumeActiveServer()) {
            return START_STICKY;
        }

        stopSelf(startId);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        stopServer(false);
        executor.shutdownNow();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private boolean resumeActiveServer() {
        SharedPreferences preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!preferences.getBoolean(KEY_SERVER_ACTIVE, false)) {
            return false;
        }

        String treeUri = preferences.getString(KEY_TREE_URI, "");
        if (treeUri == null || treeUri.trim().isEmpty()) {
            clearActiveConfig();
            return false;
        }

        int port = preferences.getInt(KEY_PORT, 3000);
        String customIp = preferences.getString(KEY_CUSTOM_IP, "");
        String pin = preferences.getString(KEY_PIN, "");
        addLog("Service resumed by Android; restoring the file server.");
        startForeground(NOTIFICATION_ID, buildNotification("Restoring on port " + port, port, customIp));
        startServer(treeUri, port, customIp, pin);
        return true;
    }

    private void startServer(String treeUri, int port, String customIp, String pin) {
        setState(State.starting(port, customIp));
        addLog("Starting server on port " + port + ".");
        executor.execute(() -> {
            try {
                if (treeUri == null || treeUri.trim().isEmpty()) {
                    throw new IllegalArgumentException("Choose a folder before starting.");
                }
                stopServerInstance();
                AndroidFileServer nextServer = new AndroidFileServer(this, Uri.parse(treeUri), port, pin);
                nextServer.start();
                synchronized (LOCK) {
                    server = nextServer;
                }
                State running = State.running(port, customIp, NetUtils.accessUrls(port, customIp));
                setState(running);
                addLog("Server running. Browser links refreshed.");
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                manager.notify(NOTIFICATION_ID, buildNotification("Sharing on port " + port, port, customIp));
            } catch (Exception error) {
                String message = error.getMessage() == null ? "Unable to start server." : error.getMessage();
                clearActiveConfig();
                setState(State.error(port, customIp, message));
                addLog("Server error: " + message);
                stopForegroundCompat();
            }
        });
    }

    private void stopServer(boolean clearActiveConfig) {
        if (clearActiveConfig) {
            clearActiveConfig();
        }
        stopServerInstance();
        setState(State.stopped());
        addLog(clearActiveConfig ? "Server stopped by user." : "Service destroyed; server instance closed.");
        stopForegroundCompat();
    }

    private static void stopServerInstance() {
        synchronized (LOCK) {
            if (server != null) {
                server.stop();
                server = null;
            }
        }
    }

    private static void setState(State nextState) {
        synchronized (LOCK) {
            state = nextState;
        }
    }

    private void persistActiveConfig(String treeUri, int port, String customIp, String pin) {
        getSharedPreferences(PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_SERVER_ACTIVE, true)
                .putString(KEY_TREE_URI, treeUri)
                .putInt(KEY_PORT, port)
                .putString(KEY_CUSTOM_IP, customIp == null ? "" : customIp.trim())
                .putString(KEY_PIN, pin == null ? "" : pin)
                .apply();
    }

    private void clearActiveConfig() {
        getSharedPreferences(PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_SERVER_ACTIVE, false)
                .apply();
    }

    private Notification buildNotification(String text, int port, String customIp) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, PocketLanService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                this,
                1,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        List<String> urls = NetUtils.accessUrls(port, customIp);
        String firstUrl = urls.isEmpty() ? "No LAN IP detected" : urls.get(0);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("PocketLAN is running")
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text + "\n" + firstUrl))
                .setOngoing(true)
                .setContentIntent(openPendingIntent)
                .addAction(R.drawable.ic_notification, "Stop", stopPendingIntent)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.notification_channel_description));
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(channel);
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    static final class State {
        final String status;
        final int port;
        final String customIp;
        final String error;
        final List<String> urls;
        final List<String> logs;

        private State(String status, int port, String customIp, String error, List<String> urls, List<String> logs) {
            this.status = status;
            this.port = port;
            this.customIp = customIp;
            this.error = error;
            this.urls = urls;
            this.logs = logs;
        }

        static State stopped() {
            return new State("stopped", 0, "", "", new ArrayList<>(), new ArrayList<>());
        }

        static State starting(int port, String customIp) {
            return new State("starting", port, safe(customIp), "", new ArrayList<>(), new ArrayList<>());
        }

        static State running(int port, String customIp, List<String> urls) {
            return new State("running", port, safe(customIp), "", new ArrayList<>(urls), new ArrayList<>());
        }

        static State error(int port, String customIp, String error) {
            return new State("error", port, safe(customIp), error, new ArrayList<>(), new ArrayList<>());
        }

        State copy(List<String> logs) {
            return new State(status, port, customIp, error, new ArrayList<>(urls), new ArrayList<>(logs));
        }

        private static String safe(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
