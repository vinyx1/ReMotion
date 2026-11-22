package ca.remotion.phone

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
  Demo mode: acts like the device, replaying a recorded session (data/sample/fake_session.txt)
  in real time. It answers the same commands as the firmware: G plays the session, X ends it
  (S line), ? replies with an I line, D0/D1 hide or show the samples, T and P are accepted
  between sessions (the recording still plays with its own limit and blocks).
*/
class DemoLink(private val recording: List<String>) : DeviceLink {
    override val name = "Demo (recorded session)"

    // Everything runs on one thread, so the fields below need no locking.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default.limitedParallelism(1))
    private lateinit var emit: (String) -> Unit

    private var streaming = true
    private var threshold = 10.0f
    private var plan = listOf(3, 15, 30, 15)
    private var state = "IDLE"
    private var phase = ""
    private var reps = 0
    private var compensated = 0
    private var session: Job? = null
    private var idleTicks: Job? = null
    private var clockMs = 0L                  // the demo's millis()

    /** Where the session part of the recording starts: the comments just before the first non-idle sample. */
    private val sessionStart: Int = run {
        var i = recording.indexOfFirst { val m = Protocol.parse(it); m is Sample && m.state != "IDLE" }
        if (i < 0) i = recording.size
        while (i > 0 && recording[i - 1].startsWith("#")) i--
        i
    }

    override fun start(onLine: (String) -> Unit, onClosed: (String) -> Unit) {
        emit = onLine
        scope.launch {
            recording.takeWhile { it.startsWith("#") }.forEach { emit(it) }   // the start-up banner
            idle()
        }
    }

    override fun send(command: String) {
        scope.launch { handle(command.trim()) }
    }

    override fun close() = scope.cancel()

    private fun handle(cmd: String) {
        val running = state !in Protocol.IDLE_STATES
        when {
            (cmd.startsWith("T", true) || cmd.startsWith("P", true)) && running ->
                emit("E,threshold and plan can only change between sessions")
            cmd.startsWith("T", true) -> {
                val v = cmd.substring(1).toFloatOrNull()
                if (v != null && v in 1f..60f) { threshold = v; emit("# threshold set to ${Protocol.one(v)} deg") }
                else emit("E,threshold out of range (1-60)")
            }
            cmd.startsWith("P", true) -> {
                val p = cmd.substring(1).split(",").map { it.toIntOrNull() }
                if (p.size == 4 && p.all { it != null && it in 0..60 } && p.sumOf { it!! } > 0) {
                    plan = p.map { it!! }
                    emit("# plan: PRACTICE ${plan[0]} BASELINE ${plan[1]} TRAINING ${plan[2]} POST ${plan[3]}")
                } else emit("E,plan must be 4 numbers 0-60, not all 0 (e.g. P3,15,30,15)")
            }
            cmd.equals("D0", true) -> { streaming = false; emit("# sample stream off") }
            cmd.equals("D1", true) -> { streaming = true; emit("# sample stream on") }
            cmd.equals("G", true) ->
                if (running) emit("E,a session is already running") else play()
            cmd.equals("X", true) ->
                if (!running) emit("E,no session to end") else {
                    session?.cancel()
                    endSession()
                }
            cmd == "?" -> emit(Protocol.formatStatus(Status(state, phase, threshold, plan, streaming, reps, compensated)))
            cmd.isNotEmpty() -> emit("E,unknown command: $cmd")
        }
    }

    /** While idle the device keeps streaming IDLE samples, as the firmware does. */
    private fun idle() {
        state = "IDLE"
        idleTicks?.cancel()
        idleTicks = scope.launch {
            while (isActive) {
                if (streaming) emit("D,$clockMs,IDLE,0.0,0.0,${Protocol.one(threshold)}")
                delay(10)
                clockMs += 10
            }
        }
    }

    private fun play() {
        idleTicks?.cancel()
        reps = 0
        compensated = 0
        phase = ""
        state = "CALIBRATING"
        session = scope.launch {
            val startWall = System.currentTimeMillis()
            var firstT = -1L
            for (line in recording.drop(sessionStart)) {
                val msg = Protocol.parse(line)
                when (msg) {
                    is Sample -> {
                        if (firstT < 0) firstT = msg.tMs
                        val wait = (msg.tMs - firstT) - (System.currentTimeMillis() - startWall)
                        if (wait > 0) delay(wait)
                        state = msg.state
                        clockMs += 10
                        if (streaming) emit("D,$clockMs,${msg.state},${Protocol.one(msg.trunkDeg)},${Protocol.one(msg.wristDps)},${Protocol.one(msg.threshold)}")
                        continue
                    }
                    is Rep -> { reps = msg.rep; if (msg.compensated) compensated++; phase = msg.phase }
                    is SessionEnd -> { emit(line); finish(); return@launch }
                    else -> {}
                }
                emit(line)
            }
            endSession()
        }
    }

    private fun endSession() {
        emit("S,$reps,$compensated")
        finish()
    }

    private fun finish() {
        emit("# session ended. Press START for a new session.")
        phase = ""
        idle()
    }
}
