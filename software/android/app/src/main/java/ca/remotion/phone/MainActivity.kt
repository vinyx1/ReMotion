package ca.remotion.phone

import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // the phone is propped up across the table: it must not go dark mid-session
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent { RemotionTheme { MainScreen(vm) } }
        // the device may already be plugged in: connect without asking the patient to tap anything
        vm.connectUsb(quiet = intent?.action != UsbManager.ACTION_USB_DEVICE_ATTACHED)
        signInFrom(intent)
    }

    // The device was plugged in while the app was open (launchMode singleTop)
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == UsbManager.ACTION_USB_DEVICE_ATTACHED) vm.connectUsb()
        signInFrom(intent)
    }

    /** Opened from the dashboard's /pair page (remotion://pair?code=…): sign in with that code. */
    private fun signInFrom(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "remotion" && uri.host == "pair") vm.signInWith(uri.toString())
    }
}
