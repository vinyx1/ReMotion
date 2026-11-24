package ca.remotion.phone

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

/**
  Demo mode: a pretend device on the phone. It streams samples and answers the same
  commands as the firmware (G, X, ?, D0/D1, T, P), but a rep only happens when addRep()
  is called (the app's "Add rep" button). Each rep is clean or leaned at random and plays
  out in real time like the firmware's: WAIT_HOME (1 s hold) -> CUED -> REACHING -> R line
  -> RETURNING. Whether it counts as leaned follows the firmware's rule (past the limit for
  at least 200 ms), measured on the made-up trunk angle. Blocks follow the plan (P), with
  5 s rests where the firmware rests 30 s.
*/
class DemoLink(
    // Everything runs on one thread, so the fields below need no locking. (Tests pass a virtual clock.)
    dispatcher: CoroutineDispatcher = Dispatchers.Default.limitedParallelism(1),
    private val random: Random = Random(System.nanoTime()),
) : DeviceLink {
    override val name = "Demo device"

    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    private lateinit var emit: (String) -> Unit

    private var streaming = true
    private var threshold = 10.0f
    private var plan = Protocol.SESSION_PLAN
    private var state = "IDLE"
    private var block = -1                    // index into PHASES; -1 before the first block
    private var blockReps = 0
    private var reps = 0
    private var compensated = 0
    private var trunk = 0f
    private var wrist = 0f
    private var clockMs = 0L                  // the demo's millis()
    private var action: Job? = null           // calibration or a rep in progress

    /** A rep can start now (a session is waiting at HOME and nothing else is playing). */
    val readyForRep get() = state == "WAIT_HOME" && action?.isActive != true

    override fun start(onLine: (String) -> Unit, onClosed: (String) -> Unit) {
        emit = onLine
        scope.launch {
            emit("# ReMotion demo device (made-up data, on the phone)")
            emit("# both IMUs found. Press START to begin a session.")
            emit("# D,t_ms,state,trunk_deg,wrist_dps,threshold")
            emit("# R,rep,target,react_ms,reach_ms,peak_deg,bursts,compensated,phase")
            emitPlan()
            emit("# S,reps,compensated_reps")
            while (isActive) {                // the 100 Hz sample stream
                if (streaming) emit("D,$clockMs,$state,${Protocol.one(trunk)},${Protocol.one(wrist)},${Protocol.one(threshold)}")
                delay(SAMPLE_MS)
                clockMs += SAMPLE_MS
            }
        }
    }

    override fun send(command: String) {
        scope.launch { handle(command.trim()) }
    }

    fun addRep() {
        scope.launch {
            if (readyForRep) action = scope.launch { rep() }
            else emit("# demo: wait for the session to be at HOME before adding a rep")
        }
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
                    emitPlan()
                } else emit("E,plan must be 4 numbers 0-60, not all 0 (e.g. P3,15,30,15)")
            }
            cmd.equals("D0", true) -> { streaming = false; emit("# sample stream off") }
            cmd.equals("D1", true) -> { streaming = true; emit("# sample stream on") }
            cmd.equals("G", true) -> if (running) emit("E,a session is already running") else calibrate()
            cmd.equals("X", true) -> if (state == "IDLE") emit("E,no session to end") else {
                action?.cancel()
                endSession()
            }
            cmd == "?" -> emit(Protocol.formatStatus(Status(state, if (block >= 0) PHASES[block] else "",
                threshold, plan, streaming, reps, compensated)))
            cmd.isNotEmpty() -> emit("E,unknown command: $cmd")
        }
    }

    private fun emitPlan() =
        emit("# plan: " + PHASES.indices.joinToString(" ") { "${PHASES[it]} ${plan[it]}" })

    private fun calibrate() {
        reps = 0
        compensated = 0
        block = -1
        state = "CALIBRATING"
        emit("# calibrating: sit upright and still for 3 s")
        action = scope.launch {
            repeat(300) { trunk = noise(0.3f); wrist = noise(3f); delay(SAMPLE_MS) }
            emit("# calibration OK (std 0.2 deg)")
            emit("# session started")
            startBlock(nextBlockAfter(-1))
        }
    }

    private fun startBlock(b: Int) {
        block = b
        blockReps = 0
        emit("# ${PHASES[b]} block: ${plan[b]} reps, " + if (BUZZER[b]) "buzzer ON when leaning" else "buzzer off")
        emit("# put your hand on HOME")
        state = "WAIT_HOME"
    }

    private fun nextBlockAfter(b: Int) = (b + 1 until PHASES.size).firstOrNull { plan[it] > 0 } ?: PHASES.size

    private suspend fun rep() {
        val target = TARGETS.random(random)
        val leans = random.nextFloat() < 0.4f
        val reactMs = random.nextInt(300, 650)
        val reachMs = random.nextInt(900, 1800)
        val peak = if (leans) threshold + 3f + random.nextFloat() * 11f else 1f + random.nextFloat() * threshold * 0.5f
        val wristPeak = 90f + random.nextFloat() * 80f

        // Hand rests on HOME for 1 s, then the target lights
        repeat((HOME_HOLD_MS / SAMPLE_MS).toInt()) { trunk = noise(0.4f); wrist = noise(2f); delay(SAMPLE_MS) }
        emit("# target $target")              // the firmware says which light is on
        state = "CUED"
        repeat(reactMs / SAMPLE_MS.toInt()) { trunk = noise(0.4f); wrist = noise(4f); delay(SAMPLE_MS) }

        // The reach: the trunk tips over and back, the wrist turns; measured like the firmware
        state = "REACHING"
        val steps = reachMs / SAMPLE_MS.toInt()
        var peakSeen = 0f
        var overMs = 0L
        var sustained = false
        var bursts = 0
        var inBurst = false
        for (i in 0 until steps) {
            val x = (i + 0.5f) / steps
            val s = sin(PI * x).toFloat()
            trunk = max(0f, peak * s * s + noise(0.3f))
            wrist = max(0f, wristPeak * s + noise(6f))
            peakSeen = max(peakSeen, trunk)
            overMs = if (trunk > threshold) overMs + SAMPLE_MS else 0
            if (overMs >= LEAN_SUSTAIN_MS) sustained = true
            if (!inBurst && wrist > BURST_ENTER_DPS) { inBurst = true; bursts++ }
            if (inBurst && wrist < BURST_EXIT_DPS) inBurst = false
            delay(SAMPLE_MS)
        }

        // Target pressed: the R line, then the hand goes back
        reps++
        blockReps++
        if (sustained) compensated++
        emit("R,$reps,$target,$reactMs,$reachMs,${Protocol.one(peakSeen)},${max(bursts, 1)},${if (sustained) 1 else 0},${PHASES[block]}")
        state = "RETURNING"
        val back = 60
        val from = trunk
        for (i in 0 until back) {
            trunk = max(0f, from * (1f - (i + 1f) / back) + noise(0.3f))
            wrist = max(0f, 40f * sin(PI * (i + 0.5) / back).toFloat() + noise(4f))
            delay(SAMPLE_MS)
        }
        trunk = 0f
        wrist = 0f

        if (blockReps < plan[block]) { state = "WAIT_HOME"; return }
        val next = nextBlockAfter(block)
        if (next == PHASES.size) {
            emit("# all blocks done")
            endSession()
        } else {
            // the firmware rests 30 s before TRAINING and POST; the demo, a few seconds
            if (REST_BEFORE[next]) {
                emit("# rest ${DEMO_REST_MS / 1000} s before the ${PHASES[next]} block")
                block = next
                state = "REST"
                delay(DEMO_REST_MS)
            }
            startBlock(next)
        }
    }

    private fun endSession() {
        emit("S,$reps,$compensated")
        emit("# session ended. Press START for a new session.")
        state = "IDLE"
        block = -1
        trunk = 0f
        wrist = 0f
    }

    /** A little sensor jitter, 0 to size: the trunk angle and wrist speed are never negative. */
    private fun noise(size: Float) = random.nextFloat() * size

    private companion object {
        const val SAMPLE_MS = 10L
        const val HOME_HOLD_MS = 1000L
        const val LEAN_SUSTAIN_MS = 200L      // firmware: must lean this long to count
        const val BURST_ENTER_DPS = 60f
        const val BURST_EXIT_DPS = 30f
        val PHASES = listOf("PRACTICE", "BASELINE", "TRAINING", "POST")
        val BUZZER = listOf(false, false, true, false)
        val REST_BEFORE = listOf(false, false, true, true)
        const val DEMO_REST_MS = 5000L
        val TARGETS = listOf("GREEN", "BLUE", "RED")
    }
}
