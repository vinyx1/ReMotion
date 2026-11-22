package ca.remotion.phone

import android.app.Application
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialProber
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicLong

/** One line in the log: from the device, or a command we sent. */
data class LogLine(val id: Long, val text: String, val kind: Kind) {
    enum class Kind { SENT, SAMPLE, REP, REP_LEANED, END, STATUS, ERROR, COMMENT, OTHER }
}

data class UiState(
    /** The connected device's name; null when not connected. */
    val connected: String? = null,
    /** Something to tell the person (why a connection failed, what to do next). */
    val message: String? = null,
    val latest: Sample? = null,
    val state: String = "",
    val phase: String = "",
    val reps: Int = 0,
    val leaned: Int = 0,
    val streaming: Boolean = true,
    /** The firmware answered G, X or ? with "unknown command": it needs updating. */
    val oldFirmware: Boolean = false,
    val showSamples: Boolean = false,
    val log: List<LogLine> = emptyList(),
) {
    val sessionRunning get() = state.isNotEmpty() && state !in Protocol.IDLE_STATES
}

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val usb = app.getSystemService(UsbManager::class.java)
    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private var link: DeviceLink? = null
    private val ids = AtomicLong()
    private val writes = Dispatchers.IO.limitedParallelism(1)   // commands go out in order

    private val usbEvents = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_USB_PERMISSION ->
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) connectUsb()
                    else say("USB access was refused. Tap Connect to ask again.")
                UsbManager.ACTION_USB_DEVICE_DETACHED ->
                    if (link is UsbLink) disconnect("The device was unplugged.")
            }
        }
    }

    init {
        val filter = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        ContextCompat.registerReceiver(app, usbEvents, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    /** Find the device on USB, ask for permission if needed, then open it. */
    fun connectUsb() {
        if (link != null) return
        val driver = findDriver()
            ?: return say("No device found. Plug the ReMotion device into this phone's USB-C port. " +
                "If nothing happens, try a USB-C OTG adapter with the USB-A cable.")
        if (!usb.hasPermission(driver.device)) {
            val app = getApplication<Application>()
            val flags = if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
            val reply = Intent(ACTION_USB_PERMISSION).setPackage(app.packageName)
            usb.requestPermission(driver.device, PendingIntent.getBroadcast(app, 0, reply, flags))
            return say("Allow ReMotion to use the USB device when the phone asks.")
        }
        open(UsbLink(usb, driver))
    }

    /** Known USB-serial chips first; otherwise any Arduino, which talks plain USB serial (CDC-ACM). */
    private fun findDriver(): UsbSerialDriver? {
        UsbSerialProber.getDefaultProber().findAllDrivers(usb).firstOrNull()?.let { return it }
        val arduino = usb.deviceList.values.firstOrNull { it.vendorId == 0x2341 || it.vendorId == 0x2A03 }
        return arduino?.let { CdcAcmSerialDriver(it) }
    }

    fun startDemo() {
        if (link != null) return
        viewModelScope.launch {
            val lines = withContext(Dispatchers.IO) {
                getApplication<Application>().assets.open("fake_session.txt").bufferedReader().readLines()
            }
            open(DemoLink(lines))
        }
    }

    private fun open(l: DeviceLink) {
        try {
            l.start(onLine = ::onLine, onClosed = { reason -> viewModelScope.launch { if (link === l) disconnect(reason) } })
        } catch (e: Exception) {
            l.close()
            return say("Couldn't open the device: ${e.message}")
        }
        link = l
        _ui.update { UiState(connected = l.name, showSamples = it.showSamples) }
        send(Protocol.STATUS)                  // find out what the device is doing right now
    }

    fun disconnect(reason: String? = null) {
        val l = link ?: return
        link = null
        l.close()
        _ui.update { UiState(message = reason, showSamples = it.showSamples) }
    }

    fun send(command: String) {
        val l = link ?: return
        log("→ $command", LogLine.Kind.SENT)
        viewModelScope.launch(writes) {
            try {
                l.send(command)
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { if (link === l) disconnect("Couldn't send to the device (${e.message}).") }
            }
        }
    }

    fun setShowSamples(show: Boolean) = _ui.update { it.copy(showSamples = show) }

    /** Called on a background thread for every line the device sends. */
    private fun onLine(line: String) {
        val msg = Protocol.parse(line)
        _ui.update { s ->
            val next = when (msg) {
                is Sample -> s.copy(latest = msg, state = msg.state)
                is Rep -> s.copy(reps = msg.rep, phase = msg.phase,
                    leaned = (if (msg.rep == 1) 0 else s.leaned) + if (msg.compensated) 1 else 0)
                is SessionEnd -> s.copy(reps = msg.reps, leaned = msg.compensatedReps, phase = "")
                is Status -> s.copy(state = msg.state, phase = msg.phase, reps = msg.reps,
                    leaned = msg.compensatedReps, streaming = msg.streaming)
                is DeviceError -> {
                    val old = msg.message.removePrefix("unknown command: ") in setOf("G", "X", "?")
                    s.copy(oldFirmware = s.oldFirmware || old)
                }
                is Comment -> when (msg.text) {
                    "sample stream off" -> s.copy(streaming = false)
                    "sample stream on" -> s.copy(streaming = true)
                    else -> s
                }
                null -> s
            }
            if (msg is Sample && !s.showSamples) next
            else next.copy(log = (next.log + LogLine(ids.incrementAndGet(), line, kindOf(msg))).takeLast(MAX_LOG))
        }
    }

    private fun kindOf(msg: Message?) = when (msg) {
        is Sample -> LogLine.Kind.SAMPLE
        is Rep -> if (msg.compensated) LogLine.Kind.REP_LEANED else LogLine.Kind.REP
        is SessionEnd -> LogLine.Kind.END
        is Status -> LogLine.Kind.STATUS
        is DeviceError -> LogLine.Kind.ERROR
        is Comment -> LogLine.Kind.COMMENT
        null -> LogLine.Kind.OTHER
    }

    private fun log(text: String, kind: LogLine.Kind) =
        _ui.update { it.copy(log = (it.log + LogLine(ids.incrementAndGet(), text, kind)).takeLast(MAX_LOG)) }

    private fun say(message: String) = _ui.update { it.copy(message = message) }

    override fun onCleared() {
        link?.close()
        link = null
        getApplication<Application>().unregisterReceiver(usbEvents)
    }

    companion object {
        const val ACTION_USB_PERMISSION = "ca.remotion.phone.USB_PERMISSION"
        const val MAX_LOG = 300
    }
}
