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

data class SignInState(val busy: Boolean = false, val error: String? = null)

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
    val state: String = "",
    val phase: String = "",
    val reps: Int = 0,
    val leaned: Int = 0,
    val streaming: Boolean = true,
    /** From the device's last I line: its lean limit (degrees) and reps per block. */
    val threshold: Float = 0f,
    val plan: List<Int> = emptyList(),
    /** The device's last E line (e.g. why calibration was rejected); "" until there is one. */
    val deviceError: String = "",
    /**
      Set when the readings say the sensors, not the person, are the problem (a frozen wrist
      reading, a calibration with jumps no one sitting can make, one that passed with no noise at
      all): tell them to check the cable and replug. Cleared by a calibration that looks normal.
    */
    val sensorTrouble: Boolean = false,
    /** Calibrations rejected in a row (for "still rejected? replug" after a few). */
    val calibFails: Int = 0,
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

    private val _login = MutableStateFlow(Account.load(app))
    /** Who this phone is signed in as (a patient on a dashboard); null until it signs in with a code. */
    val login: StateFlow<Login?> = _login.asStateFlow()
    private val _signIn = MutableStateFlow(SignInState())
    /** The sign-in screen: busy, and what went wrong or why the phone was signed out. */
    val signIn: StateFlow<SignInState> = _signIn.asStateFlow()
    private val _exercise = MutableStateFlow(Exercise.of(prefs.getString(KEY_EXERCISE, null)))
    /** The exercise chosen on the setup screen; the next session is this one. */
    val exercise: StateFlow<Exercise> = _exercise.asStateFlow()
    fun chooseExercise(e: Exercise) {
        _exercise.value = e
        prefs.edit().putString(KEY_EXERCISE, e.id).apply()
        usePatientPlan()
    }
    private val _hello = MutableStateFlow<String?>(null)
    /** Set right after a sign-in: the first name the "Hello" screen greets, until it's done. */
    val hello: StateFlow<String?> = _hello.asStateFlow()
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
        // a sign-in can end while the app is closed (a demo's hour, a deleted patient): check
        _login.value?.let { l ->
            viewModelScope.launch(Dispatchers.IO) {
                if (Account.stillSignedIn(l) == false) withContext(Dispatchers.Main) { endSignIn(l) }
            }
        }
    }

    // ---------------------------------------------------------------- signing in

    /**
      Sign in with what the patient scanned or typed: the QR code's link, the /pair page's app
      link, or the 6-letter code (then the dashboard address from Settings).
    */
    fun signInWith(text: String) {
        val app = getApplication<Application>()
        val target = Account.parse(text, _ui.value.dashboard.trim().ifEmpty { DEFAULT_DASHBOARD })
            ?: return run {
                _signIn.value = SignInState(error = if (text.isBlank()) "The camera couldn’t scan here. Type the code instead."
                                                    else "That isn’t a ReMotion code. It’s 6 letters and numbers, like ABC 123.")
            }
        _signIn.value = SignInState(busy = true)
        viewModelScope.launch {
            try {
                val l = withContext(Dispatchers.IO) { Account.pair(target.first, target.second) }
                Account.save(app, l)
                // a different patient on this phone starts a fresh week
                val who = "${l.server}|${l.patientId}"
                if (prefs.getString(KEY_HISTORY_OWNER, who) != who) _past.value = withContext(Dispatchers.IO) { history.clear() }
                prefs.edit().putString(KEY_HISTORY_OWNER, who).apply()
                _hello.value = l.firstName
                _login.value = l
                _signIn.value = SignInState()
                link?.let { startUploader(it) }
            } catch (e: Exception) {
                _signIn.value = SignInState(error = (e as? SignInError)?.message ?: "Couldn’t sign in (${e.message}).")
            }
        }
    }

    /** "Sign out of this phone" in Settings. */
    fun signOutPhone() {
        val l = _login.value ?: return
        viewModelScope.launch(Dispatchers.IO) { Account.signOut(l) }
        endSignIn(l, note = null)
    }

    /** The sign-in ended (here, or on the server): back to the sign-in screen, with why. */
    private fun endSignIn(l: Login, note: String? = if (l.demo) "Your demo has ended. Scan a new code to sign in again."
                                                    else "This phone was signed out. Scan your code to sign in again.") {
        if (_login.value != l) return
        Account.clear(getApplication())
        _login.value = null
        uploader?.close(viewModelScope)
        uploader = null
        _ui.update { it.copy(upload = null) }
        _signIn.value = SignInState(error = note)
    }

    /** Sends the device's lines to the signed-in patient's dashboard; without a sign-in they stay on the phone. */
    private fun startUploader(l: DeviceLink) {
        val who = _login.value ?: return
        uploader?.close(viewModelScope)
        uploader = Uploader(who.server, who.token, who.patientId, demo = l is DemoLink, exercise = { _exercise.value.id }, scope = viewModelScope,
            onStatus = { st -> _ui.update { it.copy(upload = st) } },
            onSignedOut = { viewModelScope.launch { endSignIn(who) } })
        _ui.update { it.copy(upload = Uploader.Status(who.server)) }
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
        _ui.update { UiState(connected = l.name, demo = l is DemoLink, dashboard = it.dashboard, showSamples = it.showSamples) }
        startUploader(l)
        try {
            l.start(onLine = ::onLine, onClosed = { reason -> viewModelScope.launch { if (link === l) disconnect(reason) } })
        } catch (e: Exception) {
            l.close()
            uploader?.close(viewModelScope)
            uploader = null
            _ui.update { UiState(message = "Couldn't open the device: ${e.message}", dashboard = it.dashboard, showSamples = it.showSamples) }
            return
        }
        link = l
        checkPlan = true                       // the first I line says whether the plan needs setting
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

    @Volatile private var checkPlan = false

    private val _leanLimit = MutableStateFlow(prefs.getFloat(KEY_LEAN_LIMIT, 10f))
    /**
      The lean limit this phone puts on the device (T<deg>), in degrees past the calibrated upright.
      10 by default; raise it for someone whose normal sitting posture already reads a few degrees
      forward. Kept on the phone and sent on every connect (the device forgets it when unplugged).
    */
    val leanLimit: StateFlow<Float> = _leanLimit.asStateFlow()
    fun setLeanLimit(deg: Float) {
        val v = (Math.round(deg * 2) / 2f).coerceIn(MIN_LIMIT, MAX_LIMIT)
        _leanLimit.value = v
        prefs.edit().putFloat(KEY_LEAN_LIMIT, v).apply()
        if (link != null && !_ui.value.sessionRunning) { send("T" + Protocol.one(v)); send(Protocol.STATUS) }
    }

    /** Put the patient's plan (Protocol.SESSION_PLAN) on the device, if it has another one. Only between sessions. */
    fun usePatientPlan() {
        val s = _ui.value
        if (link != null && !s.sessionRunning && s.plan != Protocol.SESSION_PLAN) setPlan(Protocol.SESSION_PLAN)
    }

    /** Reaches per block, sent to the device (only between sessions). */
    fun setPlan(plan: List<Int>) = send("P" + plan.joinToString(","))

    /**
      One of the demos (Demo.kt, as in software/tools/demo.py): set the plan, read it back, and
      start the session at once, as START would. Only between sessions. The device keeps the plan
      afterwards, so the next yellow-button press runs the same demo again.
    */
    fun runDemo(plan: List<Int>) {
        if (link == null || _ui.value.sessionRunning) return
        setPlan(plan)
        send(Protocol.STATUS)
        send(Protocol.START)
    }

    fun dismissFinished() { _finished.value = null }

    fun dismissHello() { _hello.value = null }

    fun setShowSamples(show: Boolean) = _ui.update { s ->
        s.copy(showSamples = show, log = if (show) s.log else s.log.filter { it.kind != LogLine.Kind.SAMPLE })
    }

    // a wrist reading that doesn't change at all: a healthy sensor never repeats one value more
    // than a few samples in a row (7 at most in a real session); 1.5 s of the same means it stopped answering
    private var lastWrist = Float.NaN
    private var sameWrist = 0

    /** Called on a background thread for every line the device sends. */
    private fun onLine(line: String) {
        uploader?.add(line)
        val msg = Protocol.parse(line)
        // the demo device holds made-up readings perfectly still between reaches, so only a real device can look frozen
        val frozen = msg is Sample && msg.state != "IDLE" && link !is DemoLink && run {
            sameWrist = if (msg.wristDps == lastWrist) sameWrist + 1 else 0
            lastWrist = msg.wristDps
            sameWrist >= FROZEN_SAMPLES
        }
        if (msg is SessionEnd) endOfSession()
        if (msg is Status && checkPlan) {                    // just connected: a demo may have left its plan
            checkPlan = false
            if (msg.state in Protocol.IDLE_STATES) {
                var changed = false
                if (msg.plan != Protocol.SESSION_PLAN) { setPlan(Protocol.SESSION_PLAN); changed = true }
                if (kotlin.math.abs(msg.threshold - _leanLimit.value) > 0.01f) { send("T" + Protocol.one(_leanLimit.value)); changed = true }
                if (changed) send(Protocol.STATUS)
            }
        }
        _ui.update { s ->
            val next = when (msg) {
                // 100 samples a second: the state only changes (and the screen only redraws) when
                // the device's state or the leaning does, not with every reading
                is Sample -> s.copy(state = msg.state, leaning = leaning(msg, s), sensorTrouble = s.sensorTrouble || frozen)
                is Rep -> s.copy(reps = msg.rep, phase = msg.phase,
                    leaned = (if (msg.rep == 1) 0 else s.leaned) + if (msg.compensated) 1 else 0,
                    blockDone = s.blockDone + 1, blockUpright = s.blockUpright + if (msg.compensated) 0 else 1,
                    lastRep = msg, sessionReps = s.sessionReps + msg,
                    leaning = s.leaning || msg.compensated)            // the device's verdict keeps the warning up
                is SessionEnd -> s.copy(reps = msg.reps, leaned = msg.compensatedReps, phase = "", target = "",
                    blockSize = 0, blockDone = 0, blockUpright = 0, lastRep = null, sessionReps = emptyList(),
                    restEndsAt = 0, leaning = false)
                is Status -> s.copy(state = msg.state, phase = msg.phase, reps = msg.reps,
                    leaned = msg.compensatedReps, streaming = msg.streaming, threshold = msg.threshold, plan = msg.plan)
                is DeviceError -> {
                    val old = msg.message.removePrefix("unknown command: ") in setOf("G", "X", "?")
                    // "calibration rejected: moved too much (std 0.35 m/s2)": a person sitting
                    // makes well under 1; several m/s2 is the sensor jumping, not them
                    val std = CALIB_STD.find(msg.message)?.groupValues?.get(1)?.toFloatOrNull()
                    val rejected = "calibration rejected" in msg.message
                    s.copy(oldFirmware = s.oldFirmware || old, deviceError = msg.message,
                        calibFails = if (rejected) s.calibFails + 1 else s.calibFails,
                        sensorTrouble = s.sensorTrouble || "no gravity" in msg.message || (std != null && std > JUMPY_STD))
                }
                is Comment -> when {
                    msg.text == "sample stream off" -> s.copy(streaming = false)
                    msg.text == "sample stream on" -> s.copy(streaming = true)
                    // a new session: last session's numbers no longer apply
                    msg.text.startsWith("calibrating") -> s.copy(reps = 0, leaned = 0, phase = "", target = "",
                        blockSize = 0, blockDone = 0, blockUpright = 0, lastRep = null, sessionReps = emptyList(), restEndsAt = 0)
                    msg.text.startsWith("target ") -> s.copy(target = msg.text.removePrefix("target ").trim())
                    // "# calibration OK (std 0.16 m/s2)": exactly no noise means frozen readings
                    msg.text.startsWith("calibration OK") -> {
                        val std = CALIB_STD.find(msg.text)?.groupValues?.get(1)?.toFloatOrNull()
                        if (std != null && std < FROZEN_STD) s.copy(sensorTrouble = true)
                        else s.copy(sensorTrouble = false, calibFails = 0).also { sameWrist = 0 }
                    }
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
      Once a reach counts as leaning, the warning stays up until the next reach is cued: through
      the press, the return and the wait at HOME. (It used to clear the moment the reach ended,
      so straightening up, or pressing the button, took the message away before it could be read.)
    */
    private fun leaning(sample: Sample, s: UiState): Boolean {
        when (sample.state) {
            "REACHING" -> {}
            "RETURNING", "WAIT_HOME" -> { overSinceMs = -1; return s.leaning }
            else -> { overSinceMs = -1; return false }          // CUED: a new reach starts clean; REST, ...
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
        val done = History.summarize(reps, demo = link is DemoLink, exercise = _exercise.value)
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
        private const val KEY_HISTORY_OWNER = "historyFor"
        private const val KEY_EXERCISE = "exercise"
        private const val KEY_LEAN_LIMIT = "leanLimit"
        private val CALIB_STD = Regex("""std ([0-9.]+)""")
        private const val JUMPY_STD = 1.5f            // m/s2; people sitting: under 1 (rejections were 0.35-0.89)
        private const val FROZEN_STD = 0.02f          // m/s2; a live sensor always shows some noise (0.12-0.19)
        private const val FROZEN_SAMPLES = 150        // 1.5 s at 100 Hz
        const val MIN_LIMIT = 6f
        const val MAX_LIMIT = 20f
        /**
          Where a typed code is sent (a scanned QR code carries its own address). With the phone on a
          cable, `adb reverse tcp:5173 tcp:5173` makes this the Mac's dashboard; once it's online,
          its address goes in Settings.
        */
        const val DEFAULT_DASHBOARD = "http://localhost:5173"
    }
}
