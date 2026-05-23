package com.tukifac.tukichef;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge para safe areas (notch, status bar, navigation bar).
 * La WebView aplica env(safe-area-inset-*) vía CSS en el frontend.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
