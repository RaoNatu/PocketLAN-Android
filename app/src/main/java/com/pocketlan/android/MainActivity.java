package com.pocketlan.android;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import java.net.URLDecoder;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private static final int REQUEST_FOLDER = 1001;
    private static final int REQUEST_NOTIFICATIONS = 1002;
    private static final String PREFS = PocketLanService.PREFS;
    private static final String KEY_TREE_URI = PocketLanService.KEY_TREE_URI;
    private static final String KEY_PORT = PocketLanService.KEY_PORT;
    private static final String KEY_CUSTOM_IP = PocketLanService.KEY_CUSTOM_IP;
    private static final String KEY_PIN = PocketLanService.KEY_PIN;
    private static final String KEY_THEME_MODE = "themeMode";
    private static final String THEME_DARK = "dark";
    private static final String THEME_LIGHT = "light";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private SharedPreferences preferences;
    private TextView subtitleText;
    private TextView statusBadge;
    private TextView folderText;
    private TextInputEditText customIpInput;
    private TextInputEditText portInput;
    private TextInputEditText pinInput;
    private TextInputLayout customIpLayout;
    private TextInputLayout portLayout;
    private MaterialButton chooseFolderButton;
    private MaterialButton serverToggleButton;
    private MaterialButton restartButton;
    private MaterialButton themeToggleButton;
    private LinearLayout linksContainer;
    private ScrollView logsScrollView;
    private TextView logsText;
    private String selectedTreeUri;

    private final Runnable refreshRunnable = new Runnable() {
        @Override
        public void run() {
            refreshUi();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        applyStoredTheme();
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bindViews();
        restorePreferences();
        wireActions();
        requestNotificationPermission();
        PocketLanService.addLog("PocketLAN opened.");
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(refreshRunnable);
    }

    @Override
    protected void onPause() {
        super.onPause();
        persistForm();
        handler.removeCallbacks(refreshRunnable);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FOLDER || resultCode != RESULT_OK || data == null || data.getData() == null) {
            return;
        }

        Uri uri = data.getData();
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (SecurityException ignored) {
            // Some providers already keep enough transient access for the current process.
        }

        selectedTreeUri = uri.toString();
        preferences.edit().putString(KEY_TREE_URI, selectedTreeUri).apply();
        String folderName = friendlyFolderName(uri);
        folderText.setText(folderName);
        PocketLanService.addLog("Selected folder: " + folderName);
        if ("running".equals(PocketLanService.currentState().status)) {
            PocketLanService.addLog("Folder changed. Press Restart server to host the new folder.");
        }
        showMessage("Folder saved");
        refreshUi();
    }

    private void bindViews() {
        ImageView logoView = findViewById(R.id.logoView);
        logoView.setClipToOutline(true);
        subtitleText = findViewById(R.id.subtitleText);
        statusBadge = findViewById(R.id.statusBadge);
        folderText = findViewById(R.id.folderText);
        customIpInput = findViewById(R.id.customIpInput);
        portInput = findViewById(R.id.portInput);
        pinInput = findViewById(R.id.pinInput);
        customIpLayout = findViewById(R.id.customIpLayout);
        portLayout = findViewById(R.id.portLayout);
        chooseFolderButton = findViewById(R.id.chooseFolderButton);
        serverToggleButton = findViewById(R.id.serverToggleButton);
        restartButton = findViewById(R.id.restartButton);
        themeToggleButton = findViewById(R.id.themeToggleButton);
        linksContainer = findViewById(R.id.linksContainer);
        logsScrollView = findViewById(R.id.logsScrollView);
        logsText = findViewById(R.id.logsText);
        updateThemeButton();
    }

    private void restorePreferences() {
        selectedTreeUri = preferences.getString(KEY_TREE_URI, null);
        customIpInput.setText(preferences.getString(KEY_CUSTOM_IP, ""));
        portInput.setText(String.valueOf(preferences.getInt(KEY_PORT, 3000)));
        pinInput.setText(preferences.getString(KEY_PIN, ""));
        if (selectedTreeUri == null) {
            folderText.setText("No folder selected");
        } else {
            folderText.setText(friendlyFolderName(Uri.parse(selectedTreeUri)));
        }
    }

    private void wireActions() {
        chooseFolderButton.setOnClickListener(view -> chooseFolder());
        serverToggleButton.setOnClickListener(view -> {
            PocketLanService.State state = PocketLanService.currentState();
            if ("running".equals(state.status) || "starting".equals(state.status)) {
                stopSharing();
            } else {
                startSharing(false);
            }
        });
        restartButton.setOnClickListener(view -> startSharing(true));
        themeToggleButton.setOnClickListener(view -> toggleTheme());
    }

    private void chooseFolder() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(intent, REQUEST_FOLDER);
    }

    private void startSharing(boolean restart) {
        Integer port = parsePort();
        if (port == null) {
            return;
        }
        String customIp = parseCustomIp();
        if (customIp == null) {
            return;
        }
        if (selectedTreeUri == null || selectedTreeUri.trim().isEmpty()) {
            PocketLanService.addLog("Start blocked: no shared folder selected.");
            showMessage("Choose a folder first");
            return;
        }

        persistForm();
        Intent intent = new Intent(this, PocketLanService.class);
        intent.setAction(PocketLanService.ACTION_START);
        intent.putExtra(PocketLanService.EXTRA_TREE_URI, selectedTreeUri);
        intent.putExtra(PocketLanService.EXTRA_PORT, port);
        intent.putExtra(PocketLanService.EXTRA_CUSTOM_IP, customIp);
        intent.putExtra(PocketLanService.EXTRA_PIN, textOf(pinInput));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        PocketLanService.addLog((restart ? "Restart requested" : "Start requested") + " from the app.");
        showMessage(restart ? "Restarting PocketLAN" : "Starting PocketLAN");
        refreshUi();
    }

    private void stopSharing() {
        Intent intent = new Intent(this, PocketLanService.class);
        intent.setAction(PocketLanService.ACTION_STOP);
        startService(intent);
        PocketLanService.addLog("Stop requested from the app.");
        showMessage("Stopping PocketLAN");
        refreshUi();
    }

    private void refreshUi() {
        PocketLanService.State state = PocketLanService.currentState();
        boolean running = "running".equals(state.status);
        boolean starting = "starting".equals(state.status);
        boolean stopped = "stopped".equals(state.status);
        boolean error = "error".equals(state.status);

        if (running) {
            statusBadge.setText("Running");
            statusBadge.setBackgroundResource(R.drawable.status_running);
            subtitleText.setText("Sharing on port " + state.port + " in the background");
        } else if (starting) {
            statusBadge.setText("Starting");
            statusBadge.setBackgroundResource(R.drawable.status_stopped);
            subtitleText.setText("Preparing the file server");
        } else if (error) {
            statusBadge.setText("Error");
            statusBadge.setBackgroundResource(R.drawable.status_error);
            subtitleText.setText(state.error == null || state.error.isEmpty() ? "Server failed to start" : state.error);
        } else {
            statusBadge.setText("Stopped");
            statusBadge.setBackgroundResource(R.drawable.status_stopped);
            subtitleText.setText("Share a device folder over your local network");
        }

        serverToggleButton.setEnabled(stopped || error || running || starting);
        serverToggleButton.setText(running || starting ? "Stop server" : "Start server");
        serverToggleButton.setIconResource(running || starting ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        serverToggleButton.setBackgroundTintList(ColorStateList.valueOf(getColorCompat(running || starting ? R.color.pocket_rose : R.color.pocket_emerald)));

        restartButton.setEnabled(!starting && selectedTreeUri != null && !selectedTreeUri.trim().isEmpty());
        chooseFolderButton.setEnabled(!starting);
        customIpInput.setEnabled(!starting);
        portInput.setEnabled(!starting);
        pinInput.setEnabled(!starting);

        renderLinks(state);
        renderLogs(state.logs);
    }

    private void renderLinks(PocketLanService.State state) {
        linksContainer.removeAllViews();
        if (!"running".equals(state.status)) {
            TextView empty = new TextView(this);
            empty.setText("Links appear after the server is running.");
            empty.setTextColor(getColorCompat(R.color.pocket_muted));
            empty.setTextSize(14);
            empty.setPadding(dp(14), dp(14), dp(14), dp(14));
            empty.setBackgroundResource(R.drawable.card_bg);
            linksContainer.addView(empty);
            return;
        }

        List<String> urls = state.urls;
        if (urls.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("No LAN IPv4 address detected. Keep Wi-Fi enabled, or enter a custom IP and restart.");
            empty.setTextColor(getColorCompat(R.color.pocket_muted));
            empty.setTextSize(14);
            empty.setPadding(dp(14), dp(14), dp(14), dp(14));
            empty.setBackgroundResource(R.drawable.card_bg);
            linksContainer.addView(empty);
            return;
        }

        for (String url : urls) {
            linksContainer.addView(linkRow(url, linkLabel(url, state.customIp)));
        }
    }

    private View linkRow(String url, String labelText) {
        MaterialCardView card = new MaterialCardView(this);
        card.setCardBackgroundColor(getColorCompat(R.color.pocket_surface_alt));
        card.setCardElevation(0);
        card.setRadius(dp(8));
        card.setStrokeColor(getColorCompat(R.color.pocket_glass_line));
        card.setStrokeWidth(dp(1));

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(cardParams);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(dp(14), dp(12), dp(14), dp(14));
        card.addView(row);

        TextView label = new TextView(this);
        label.setText(labelText);
        label.setTextColor(getColorCompat(R.color.pocket_text));
        label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setTextSize(14);
        row.addView(label);

        TextView link = new TextView(this);
        link.setText(url);
        link.setTextColor(getColorCompat(R.color.pocket_cyan));
        link.setTextSize(14);
        link.setInputType(InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        link.setPadding(0, dp(4), 0, dp(10));
        row.addView(link);

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.END);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        row.addView(actions);

        MaterialButton copy = smallButton("Copy");
        copy.setOnClickListener(view -> copyText(url));
        actions.addView(copy);

        MaterialButton share = smallButton("Share");
        share.setOnClickListener(view -> shareText(url));
        actions.addView(share);

        MaterialButton open = smallButton("Open");
        open.setOnClickListener(view -> openUrl(url));
        actions.addView(open);

        return card;
    }

    private String linkLabel(String url, String customIp) {
        if (url.contains("127.0.0.1") || url.contains("localhost")) {
            return "This device";
        }
        String custom = customIp == null ? "" : customIp.trim();
        if (!custom.isEmpty() && url.contains(custom)) {
            return "Custom address";
        }
        return "LAN address";
    }

    private MaterialButton smallButton(String text) {
        MaterialButton button = new MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(42)
        );
        params.setMargins(dp(8), 0, 0, 0);
        button.setLayoutParams(params);
        button.setText(text);
        button.setTextColor(getColorCompat(R.color.pocket_cyan));
        button.setStrokeColorResource(R.color.pocket_cyan);
        button.setCornerRadius(dp(8));
        button.setMinWidth(dp(72));
        button.setInsetTop(0);
        button.setInsetBottom(0);
        return button;
    }

    private void copyText(String text) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("PocketLAN link", text));
        PocketLanService.addLog("Copied link: " + text);
        showMessage("Copied");
    }

    private void shareText(String text) {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        PocketLanService.addLog("Opened share sheet for: " + text);
        startActivity(Intent.createChooser(intent, "Share PocketLAN link"));
    }

    private void openUrl(String url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        PocketLanService.addLog("Opening browser link: " + url);
        startActivity(intent);
    }

    private String parseCustomIp() {
        String value = textOf(customIpInput);
        if (value.isEmpty()) {
            customIpLayout.setError(null);
            return "";
        }

        String[] parts = value.split("\\.");
        if (parts.length != 4) {
            customIpLayout.setError("Use an IPv4 address such as 192.168.1.24");
            return null;
        }

        try {
            for (String part : parts) {
                if (part.isEmpty()) {
                    throw new NumberFormatException("empty");
                }
                int valuePart = Integer.parseInt(part);
                if (valuePart < 0 || valuePart > 255) {
                    throw new NumberFormatException("out of range");
                }
            }
            customIpLayout.setError(null);
            return value;
        } catch (NumberFormatException error) {
            customIpLayout.setError("Use an IPv4 address such as 192.168.1.24");
            return null;
        }
    }

    private Integer parsePort() {
        String value = textOf(portInput);
        try {
            int port = Integer.parseInt(value);
            if (port < 1 || port > 65535) {
                throw new NumberFormatException("out of range");
            }
            portLayout.setError(null);
            return port;
        } catch (NumberFormatException error) {
            portLayout.setError("Use a port from 1 to 65535");
            return null;
        }
    }

    private void persistForm() {
        Integer port = parsePort();
        SharedPreferences.Editor editor = preferences.edit();
        if (port != null) {
            editor.putInt(KEY_PORT, port);
        }
        editor.putString(KEY_CUSTOM_IP, textOf(customIpInput));
        editor.putString(KEY_PIN, textOf(pinInput));
        editor.apply();
    }

    private void renderLogs(List<String> logs) {
        if (logs == null || logs.isEmpty()) {
            logsText.setText("No activity yet. Start the server to see events here.");
            scrollLogsToBottom();
            return;
        }

        StringBuilder builder = new StringBuilder();
        int start = Math.max(0, logs.size() - 40);
        for (int index = start; index < logs.size(); index += 1) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(logs.get(index));
        }
        logsText.setText(builder.toString());
        scrollLogsToBottom();
    }

    private void scrollLogsToBottom() {
        logsScrollView.post(() -> logsScrollView.fullScroll(View.FOCUS_DOWN));
    }

    private void applyStoredTheme() {
        AppCompatDelegate.setDefaultNightMode(isDarkMode() ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO);
    }

    private boolean isDarkMode() {
        return THEME_DARK.equals(preferences.getString(KEY_THEME_MODE, THEME_DARK));
    }

    private void toggleTheme() {
        boolean nextDark = !isDarkMode();
        preferences.edit().putString(KEY_THEME_MODE, nextDark ? THEME_DARK : THEME_LIGHT).apply();
        PocketLanService.addLog("Theme changed to " + (nextDark ? "dark" : "light") + " mode.");
        AppCompatDelegate.setDefaultNightMode(nextDark ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO);
        updateThemeButton();
    }

    private void updateThemeButton() {
        boolean dark = isDarkMode();
        themeToggleButton.setIconResource(dark ? R.drawable.ic_sun : R.drawable.ic_moon);
        themeToggleButton.setContentDescription(dark ? "Switch to light mode" : "Switch to dark mode");
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }
    }

    private String friendlyFolderName(Uri uri) {
        try {
            String documentId = DocumentsContract.getTreeDocumentId(uri);
            int colon = documentId.lastIndexOf(':');
            String name = colon >= 0 ? documentId.substring(colon + 1) : documentId;
            if (name == null || name.trim().isEmpty()) {
                name = "Selected folder";
            }
            return URLDecoder.decode(name, "UTF-8");
        } catch (Exception error) {
            return uri.toString();
        }
    }

    private String textOf(TextInputEditText editText) {
        return editText.getText() == null ? "" : editText.getText().toString().trim();
    }

    private void showMessage(String message) {
        View root = findViewById(R.id.rootScroll);
        Snackbar.make(root, message, Snackbar.LENGTH_SHORT).show();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private int getColorCompat(int color) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return getColor(color);
        }
        return getResources().getColor(color);
    }
}
