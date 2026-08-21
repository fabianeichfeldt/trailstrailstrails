package org.trailradar.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android enforces edge-to-edge for apps targeting SDK 35+ (see
        // android/variables.gradle) — the status-bar plugin's overlaysWebView
        // flag is built on deprecated flags the OS now ignores, so it can no
        // longer reserve space for us, and Chromium only maps
        // env(safe-area-inset-*) from actual display cutouts, not the general
        // status/nav bar. Padding the WebView directly with the real
        // WindowInsets is the one mechanism the OS can't route around.
        android.webkit.WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.parseColor("#16181a"));
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(0, bars.top, 0, bars.bottom);
            return windowInsets;
        });
        // The WebView is already attached by the time super.onCreate() returns,
        // so it already received one insets pass before the listener above was
        // registered — without this, padding stays 0 until the next insets
        // change (rotation, keyboard), which is why the status bar still
        // covered content on first launch.
        ViewCompat.requestApplyInsets(webView);
    }
}
