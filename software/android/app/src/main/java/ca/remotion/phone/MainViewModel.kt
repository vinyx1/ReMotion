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
    /** Connected to the demo device (the Add rep button shows). */
    val demo: Boolean = false,
    /** The dashboard server the lines go to, e.g. http://192.168.1.20:5173 */
    val dashboard: String = "",
    val upload: Uploader.Status? = null,
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

    // ---- the session as the patient follows it ----
    /** The target that's lit ("GREEN"), from the firmware's "# target" line; "" before the first cue. */
    val target: String = "",
    /** Reaches in the current block, and how many are done / were upright. */
    val blockSize: Int = 0,
    val blockDone: Int = 0,
    val blockUpright: Int = 0,
    /** The last finished reach of this session. */
    val lastRep: Rep? = null,
    /** Every reach of this session so far. */
    val sessionReps: List<Rep> = emptyList(),
    /** While resting between blocks: when the rest ends (phone clock, ms) and which block comes next. */
    val restEndsAt: Long = 0,
    val nextBlock: String = "",
    /** The trunk has been past the limit for 200 ms during a reach (the firmware's rule). */
    val leaning: Boolean = false,
) {
    val sessionRunning get() = state.isNotEmpty() && state !in Protocol.IDLE_STATES
    /** Feedback on leaning only in the training block: baseline and post measure the patient without it. */
    val feedback get() = phase == "TRAINING"
}

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val usb = app.getSystemService(UsbManager::class.java)
    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private var link: DeviceLink? = null
    private val history = History(app)
    private val _past = MutableStateFlow(history.load())
    /** Sessions done on this phone, oldest first (the week, "last time"). */
    val past: StateFlow<List<PastSession>> = _past.asStateFlow()
    private val _finished = MutableStateFlow<PastSession?>(null)
    /** The session that just ended, until the patient taps Done. */
    val finished: StateFlow<PastSession?> = _finished.asStateFlow()
    @Volatile private var overSinceMs = -1L        // sample time the trunk went past the limit
    @Volatile private var uploader: Uploader? = null
    private val prefs = app.getSharedPreferences("settings", Context.MODE_PRIVATE)
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
        _ui.update { it.copy(dashboard = prefs.getString(KEY_DASHBOARD, null) ?: DEFAULT_DASHBOARD) }
        val filter = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        ContextCompat.registerReceiver(app, usbEvents, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    /** Find the device on USB, ask for permission if needed, then open it. Quiet: say nothing if it isn't there. */
    fun connectUsb(quiet: Boolean = false) {
        if (link != null) return
        val driver = findDriver()
            ?: return if (quiet) Unit else say("The phone can't find the device. Check the cable is pushed in at both ends. " +
                "If it still isn't found, try the USB-A cable with the small adapter.")
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
        if (link == null) open(DemoLink())
    }

    /** Demo mode only: play one rep, clean or leaned at random. */
    fun addDemoRep() = (link as? DemoLink)?.addRep()

    fun setDashboard(address: String) {
        _ui.update { it.copy(dashboard = address) }
        prefs.edit().putString(KEY_DASHBOARD, address.trim()).apply()
    }

    private fun open(l: DeviceLink) {
        // The uploader and a fresh screen come first, so not even the device's first lines are missed
        val address = _ui.value.dashboard.trim().ifEmpty { DEFAULT_DASHBOARD }
        val up = try {
            Uploader(address, PATIENT_ID, demo = l is DemoLink, scope = viewModelScope) { st -> _ui.update { it.copy(upload = st) } }
        } catch (e: Exception) {
            null
        }
        _ui.update {
            UiState(connected = l.name, demo = l is DemoLink, dashboard = it.dashboard, showSamples = it.showSamples,
                upload = up?.let { Uploader.Status(address) },
                message = if (up == null) "\"$address\" isn't a web address, so nothing goes to the dashboard. Disconnect to fix it." else null)
        }
        uploader = up
        try {
            l.start(onLine = ::onLine, onClosed = { reason -> viewModelScope.launch { if (link === l) disconnect(reason) } })
        } catch (e: Exception) {
            l.close()
            up?.close(viewModelScope)
            uploader = null
            _ui.update { UiState(message = "Couldn't open the device: ${e.message}", dashboard = it.dashboard, showSamples = it.showSamples) }
            return
        }
        link = l
        send(Protocol.STATUS)                  // find out what the device is doing right now
    }

    fun disconnect(reason: String? = null) {
        val l = link ?: return
        link = null
        l.close()
        uploader?.close(viewModelScope)
        uploader = null
        _ui.update { UiState(message = reason, dashboard = it.dashboard, showSamples = it.showSamples) }
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

    /** Reaches per block, sent to the device (only between sessions). */
    fun setPlan(plan: List<Int>) = send("P" + plan.joinToString(","))

    fun dismissFinished() { _finished.value = null }

    fun setShowSamples(show: Boolean) = _ui.update { s ->
        s.copy(showSamples = show, log = if (show) s.log else s.log.filter { it.kind != LogLine.Kind.SAMPLE })
    }

    /** Called on a background thread for every line the device sends. */
    private fun onLine(line: String) {
        uploader?.add(line)
        val msg = Protocol.parse(line)
        if (msg is SessionEnd) endOfSession()
        _ui.update { s ->
            val next = when (msg) {
                is Sample -> s.copy(latest = msg, state = msg.state, leaning = leaning(msg, s))
                is Rep -> s.copy(reps = msg.rep, phase = msg.phase,
                    leaned = (if (msg.rep == 1) 0 else s.leaned) + if (msg.compensated) 1 else 0,
                    blockDone = s.blockDone + 1, blockUpright = s.blockUpright + if (msg.compensated) 0 else 1,
                    lastRep = msg, sessionReps = s.sessionReps + msg, leaning = false)
                is SessionEnd -> s.copy(reps = msg.reps, leaned = msg.compensatedReps, phase = "", target = "",
                    blockSize = 0, blockDone = 0, blockUpright = 0, lastRep = null, sessionReps = emptyList(),
                    restEndsAt = 0, leaning = false)
                is Status -> s.copy(state = msg.state, phase = msg.phase, reps = msg.reps,
                    leaned = msg.compensatedReps, streaming = msg.streaming)
                is DeviceError -> {
                    val old = msg.message.removePrefix("unknown command: ") in setOf("G", "X", "?")
                    s.copy(oldFirmware = s.oldFirmware || old)
                }
                is Comment -> when {
                    msg.text == "sample stream off" -> s.copy(streaming = false)
                    msg.text == "sample stream on" -> s.copy(streaming = true)
                    // a new session: last session's numbers no longer apply
                    msg.text.startsWith("calibrating") -> s.copy(reps = 0, leaned = 0, phase = "", target = "",
                        blockSize = 0, blockDone = 0, blockUpright = 0, lastRep = null, sessionReps = emptyList(), restEndsAt = 0)
                    msg.text.startsWith("target ") -> s.copy(target = msg.text.removePrefix("target ").trim())
                    // "# BASELINE block: 15 reps, buzzer off"
                    BLOCK_START.find(msg.text) != null -> BLOCK_START.find(msg.text)!!.let {
                        s.copy(phase = it.groupValues[1], blockSize = it.groupValues[2].toInt(), blockDone = 0,
                            blockUpright = 0, lastRep = null, restEndsAt = 0, target = "")
                    }
                    // "# rest 30 s before the POST block"
                    REST.find(msg.text) != null -> REST.find(msg.text)!!.let {
                        s.copy(restEndsAt = System.currentTimeMillis() + it.groupValues[1].toLong() * 1000, nextBlock = it.groupValues[2])
                    }
                    else -> s
                }
                null -> s
            }
            if (msg is Sample && !s.showSamples) next
            else next.copy(log = (next.log + LogLine(ids.incrementAndGet(), line, kindOf(msg))).takeLast(MAX_LOG))
        }
    }

    /**
      The firmware's rule, for the screen: past the limit for at least 200 ms while reaching.
      Once a reach counts as leaning it stays so until the reach ends: the lean itself often
      lasts under a second, too short to read "Sit back" from across the table.
    */
    private fun leaning(sample: Sample, s: UiState): Boolean {
        if (sample.state != "REACHING") {
            overSinceMs = -1
            return false
        }
        if (s.leaning) return true
        if (sample.trunkDeg <= sample.threshold) {
            overSinceMs = -1
            return false
        }
        if (overSinceMs < 0) overSinceMs = sample.tMs
        return sample.tMs - overSinceMs >= 200
    }

    /** An S line: remember the session (for the week and "last time") and show its summary. */
    private fun endOfSession() {
        val reps = _ui.value.sessionReps
        if (reps.isEmpty()) return                            // ended before any reach: nothing to show
        val done = History.summarize(reps, demo = link is DemoLink)
        viewModelScope.launch(Dispatchers.IO) { _past.value = history.add(done) }
        _finished.value = done
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
        uploader?.close(viewModelScope)
        getApplication<Application>().unregisterReceiver(usbEvents)
    }

    companion object {
        const val ACTION_USB_PERMISSION = "ca.remotion.phone.USB_PERMISSION"
        const val MAX_LOG = 300
        private val BLOCK_START = Regex("""^(PRACTICE|BASELINE|TRAINING|POST) block: (\d+) reps""")
        private val REST = Regex("""^rest (\d+) s before the (PRACTICE|BASELINE|TRAINING|POST) block""")
        private const val KEY_DASHBOARD = "dashboard"
        /** With the phone on a cable, `adb reverse tcp:5173 tcp:5173` makes this the Mac's dashboard. */
        const val DEFAULT_DASHBOARD = "http://localhost:5173"
        /** Whose sessions these are: the dashboard's patient id (software/web/src/lib/patients.ts). */
        const val PATIENT_ID = "vincent"
        const val PATIENT_NAME = "Vincent Jiang"
    }
}
