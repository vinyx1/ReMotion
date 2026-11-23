package ca.remotion.phone

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import kotlinx.coroutines.delay
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
  Demo mode, for the care team or whoever is showing ReMotion off: the phone's version of
  ./demo.sh (software/tools/demo.py). Left, what has to be right before a demo (device,
  lean limit, dashboard, who's signed in, which exercise). Right, one card per demo: its
  blocks with and without the buzzer, how long it takes, what to tell the audience, and
  Start. The demo then runs on this screen: a 5-second "sit upright and still" countdown
  (tapping the phone would spoil the calibration), calibration, each reach with the buzzer
  on or off, then the result. A rejected calibration says why and offers Try again. Only
  Back leaves the screen. Works with the demo device too.
*/

/** One demo: reps per block (PRACTICE, BASELINE, TRAINING, POST), as in demo.py's DEMOS. */
private data class DemoRun(val name: String, val plan: List<Int>, val time: String, val say: String)

private val DEMOS = listOf(
    DemoRun("Buzzer check", listOf(0, 0, 5, 0), "about 30 s",
        "Five reaches with the buzzer on. Lean forward on one and it beeps; stay upright and it stays quiet."),
    DemoRun("No buzzer", listOf(0, 5, 0, 0), "about 30 s",
        "Five reaches with the buzzer off, like the first block of a real session. The device still marks every lean, it just doesn’t say so: the dashboard shows which ones."),
    DemoRun("Before and after", listOf(0, 3, 5, 3), "about 1 min",
        "Three reaches without the buzzer, five with it, three without again. Lean in the first three, stay upright after: the dashboard shows the drop."),
    DemoRun("Full session", listOf(3, 15, 30, 15), "about 7 min",
        "The real thing: a warm-up, 15 reaches on your own, a 30 s rest, 30 with the buzzer, another rest, 15 on your own again."),
)

/** The blocks in order, and whether the buzzer is on in each (only TRAINING). */
private val BLOCKS = listOf("Warm-up" to false, "On your own" to false, "With the buzzer" to true, "On your own again" to false)

/** Seconds of "sit upright and still" before calibration starts, so tapping Start doesn't spoil it. */
private const val COUNTDOWN_S = 5

@Composable
fun DemoScreen(s: UiState, login: Login?, exercise: Exercise, finished: PastSession?,
               onStart: (List<Int>) -> Unit, onRetry: () -> Unit, onEnd: () -> Unit, onDismissFinished: () -> Unit, onAddReach: () -> Unit,
               onDemoDevice: () -> Unit, onBack: () -> Unit) {
    // The demo runs here, on this screen: only Back leaves it. Start (or Try again) first counts
    // down, then sets the plan and starts calibration; the yellow button works too.
    var pending by remember { mutableStateOf<(() -> Unit)?>(null) }      // what to send when the countdown ends
    var countdown by remember { mutableIntStateOf(0) }
    var chosen by remember { mutableStateOf<DemoRun?>(null) }
    var hideFailure by remember { mutableStateOf(false) }
    LaunchedEffect(pending) {
        val go = pending ?: return@LaunchedEffect
        for (i in COUNTDOWN_S downTo 1) { countdown = i; delay(1000) }
        countdown = 0
        pending = null
        go()
    }
    LaunchedEffect(s.state) { if (s.state != "CALIB_FAILED") hideFailure = false }
    // the demo picked here (during its countdown the device still has the old plan); otherwise
    // whichever demo's plan the device has, e.g. after the yellow button started it
    val current = chosen ?: DEMOS.firstOrNull { it.plan == s.plan }
    val failed = s.state == "CALIB_FAILED" && !hideFailure
    val live = pending != null || s.sessionRunning || failed || finished != null
    val ready = s.connected != null && !s.sessionRunning

    fun begin(d: DemoRun) {
        chosen = d
        onDismissFinished()
        pending = { onStart(d.plan) }
    }

    Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(28.dp)) {

        // ---- left: is everything ready?
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Demo", style = CoachStyle.copy(fontSize = 28.sp, lineHeight = 32.sp), color = Forest,
                    modifier = Modifier.weight(1f).semantics { heading() })
                TextButton(onClick = onBack) { Text("Back", fontSize = 17.sp) }
            }
            Text("Before you start", style = LabelStyle.copy(fontSize = 18.sp), color = Forest, modifier = Modifier.semantics { heading() })
            Check(s.connected != null, "Device",
                when {
                    s.connected == null -> "Not connected. Plug the mat’s cable into this phone."
                    s.demo -> "Demo device: made-up reaches, no hardware"
                    else -> "Connected: ${s.connected}"
                })
            if (s.connected == null) OutlinedButton(onClick = onDemoDevice) { Text("Use the demo device instead") }
            Check(s.threshold > 0f, "Lean limit",
                if (s.threshold > 0f) "${"%.0f".format(s.threshold)}° for 200 ms sounds the buzzer (with the buzzer on)" else "Waiting for the device")
            val u = s.upload
            Check(u != null && u.error == null, "Dashboard",
                when {
                    login == null -> "Not signed in: results stay on the phone"
                    u == null -> "Starts sending when the device is connected"
                    u.error != null -> "Can’t reach ${u.address}. Results wait on the phone until it can."
                    else -> "Sending to ${u.address}"
                })
            Check(login != null, "Patient", login?.let { it.patientName + if (it.demo) " (1-hour demo account)" else "" } ?: "Nobody: sign in on the first screen")
            Check(true, "Exercise", "${exercise.title}. Change it on the Get set up screen.")
            Text("Start counts down $COUNTDOWN_S seconds, then calibrates for 3: sit upright and still, sensors on, until the first reach. " +
                "The device keeps the demo’s plan afterwards, so the yellow button runs it again; Full session puts the real plan back.",
                style = BodyStyle.copy(fontSize = 15.sp, lineHeight = 21.sp), color = Forest2, modifier = Modifier.padding(top = 4.dp))
        }

        // ---- right: the demos, or the one running
        Column(Modifier.weight(1.15f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (live) {
                LivePanel(s, current, finished, countdown = if (pending != null) countdown else 0,
                    onCancel = { pending = null; countdown = 0 },
                    onRetry = { pending = onRetry },
                    onAgain = { current?.let(::begin) },
                    onEnd = onEnd, onAddReach = onAddReach,
                    onBackToDemos = { onDismissFinished(); hideFailure = true })
            } else {
                DEMOS.forEach { d -> DemoCard(d, current = s.plan == d.plan, enabled = ready) { begin(d) } }
            }
        }
    }
}

/** The demo as it runs: the countdown, calibration, each reach, then the result. */
@Composable
private fun LivePanel(s: UiState, d: DemoRun?, finished: PastSession?, countdown: Int,
                      onCancel: () -> Unit, onRetry: () -> Unit, onAgain: () -> Unit, onEnd: () -> Unit, onAddReach: () -> Unit,
                      onBackToDemos: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().background(Panel, shape).border(1.dp, Wall, shape).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(d?.name ?: "Session", style = LabelStyle.copy(fontSize = 16.sp), color = Forest2)
        when {
            countdown > 0 -> {
                Big("Sit upright and still")
                Line("Calibration starts in $countdown s. Back against the chair, sensors on, hand on HOME.")
                OutlinedButton(onClick = onCancel) { Text("Cancel") }
            }
            s.state == "CALIBRATING" -> {
                Big("Calibrating: stay still")
                Line("3 seconds. The device is learning how you sit upright.")
            }
            s.state == "CALIB_FAILED" -> {
                Big("Calibration didn’t take")
                Line(when {
                    "no gravity" in s.deviceError -> "The chest sensor isn’t answering. Check the cable between the wrist and chest boxes, unplug and replug the device, then try again."
                    "moved too much" in s.deviceError -> "There was movement during the 3 seconds. Sit back, hands still, and try again."
                    else -> s.deviceError.ifEmpty { "Sit upright and still, then try again." }
                })
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DarkButton("Try again", onRetry)
                    OutlinedButton(onClick = onBackToDemos, modifier = Modifier.heightIn(min = 48.dp)) { Text("All demos") }
                }
                Line("The yellow button on the mat tries again too.", quiet = true)
            }
            s.sessionRunning -> {
                val buzzer = s.phase == "TRAINING"
                Text((if (s.state == "REST") "Rest" else blockLabel(s.phase)) + " · " + if (buzzer) "buzzer on" else "no buzzer",
                    style = BodyStyle.copy(fontSize = 15.sp, fontWeight = if (buzzer) FontWeight.Bold else FontWeight.Normal), color = Forest,
                    modifier = Modifier.background(if (buzzer) Wall else Wash, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp))
                if (s.blockSize > 0) {
                    val now = (s.blockDone + if (s.state in listOf("WAIT_HOME", "CUED", "REACHING")) 1 else 0).coerceIn(1, s.blockSize)
                    Big("Reach $now of ${s.blockSize}")
                }
                Line(when (s.state) {
                    "WAIT_HOME" -> "Hand on the white HOME button until a light comes on."
                    "CUED", "REACHING" -> if (s.target.isEmpty()) "Reach for the lit button." else "Reach for the ${s.target.lowercase()} button."
                    "RETURNING" -> "Back to HOME."
                    "REST" -> "A short rest before the next block."
                    else -> "Getting ready."
                })
                if (s.leaning && buzzer) {
                    Text("Leaning: the buzzer is sounding", style = BodyStyle.copy(fontWeight = FontWeight.Bold), color = TerraDeep)
                }
                s.lastRep?.let { r ->
                    Line("Last reach: peak lean ${"%.1f".format(r.peakDeg)}°, " + if (r.compensated) "leaned (marked compensated)" else "upright")
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onEnd, modifier = Modifier.heightIn(min = 48.dp)) { Text("End session") }
                    if (s.demo) TextButton(onClick = onAddReach, enabled = s.state == "WAIT_HOME") { Text("Add a reach (demo)") }
                }
            }
            finished != null -> {
                Big("Done: ${finished.upright} of ${finished.reaches} upright")
                val leaned = finished.reaches - finished.upright
                Line(if (leaned == 0) "No leans. The dashboard has every reach." else "$leaned leaned. The dashboard shows which ones and by how much.")
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (d != null) DarkButton("Run it again", onAgain)
                    OutlinedButton(onClick = onBackToDemos, modifier = Modifier.heightIn(min = 48.dp)) { Text("All demos") }
                }
            }
        }
    }
}

private fun blockLabel(phase: String) = when (phase) {
    "PRACTICE" -> "Warm-up"
    "BASELINE" -> "On your own"
    "TRAINING" -> "With the buzzer"
    "POST" -> "On your own again"
    else -> "Starting"
}

@Composable
private fun Big(text: String) = Text(text, style = CoachStyle.copy(fontSize = 30.sp, lineHeight = 34.sp), color = Forest)

@Composable
private fun Line(text: String, quiet: Boolean = false) =
    Text(text, style = BodyStyle.copy(fontSize = 16.sp, lineHeight = 22.sp), color = if (quiet) Forest2 else Forest)

@Composable
private fun DarkButton(label: String, onClick: () -> Unit) =
    Button(onClick = onClick, shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Forest, contentColor = Plaster),
        modifier = Modifier.heightIn(min = 48.dp)) { Text(label, style = LabelStyle.copy(fontSize = 17.sp)) }

@Composable
private fun Check(ok: Boolean, label: String, detail: String) {
    Row(verticalAlignment = Alignment.Top) {
        // never colour alone: a filled disc with a tick, or an empty ring
        Box(Modifier.padding(top = 2.dp).size(20.dp).background(if (ok) Eucalyptus else Plaster, CircleShape)
            .border(if (ok) 0.dp else 2.dp, Forest2.copy(alpha = 0.6f), CircleShape), contentAlignment = Alignment.Center) {
            if (ok) CheckMark(Plaster, 11.dp)
        }
        Spacer(Modifier.width(10.dp))
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(label) }
            append("  $detail")
        }, style = BodyStyle.copy(fontSize = 16.sp, lineHeight = 22.sp), color = Forest)
    }
}

@Composable
private fun DemoCard(d: DemoRun, current: Boolean, enabled: Boolean, onStart: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().background(Panel, shape).border(1.dp, Wall, shape).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(d.name, style = LabelStyle.copy(fontSize = 19.sp, lineHeight = 23.sp), color = Forest)
                Text(d.time + (if (current) " · on the device now" else ""), style = BodyStyle.copy(fontSize = 14.sp, lineHeight = 18.sp), color = Forest2)
            }
            Button(onClick = onStart, enabled = enabled, shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Forest, contentColor = Plaster),
                modifier = Modifier.heightIn(min = 48.dp)) { Text("Start", style = LabelStyle.copy(fontSize = 17.sp)) }
        }
        // the blocks, in order, with the buzzer marked
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            d.plan.forEachIndexed { i, n ->
                if (n > 0) {
                    val buzzer = BLOCKS[i].second
                    Text(if (i == 0) "$n warm-up" else if (buzzer) "$n with buzzer" else "$n without buzzer",
                        style = BodyStyle.copy(fontSize = 14.sp, lineHeight = 18.sp, fontWeight = if (buzzer) FontWeight.Bold else FontWeight.Normal),
                        color = Forest,
                        modifier = Modifier.background(if (buzzer) Wall else Wash, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp))
                }
            }
        }
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Say  ") }
            append(d.say)
        }, style = BodyStyle.copy(fontSize = 15.sp, lineHeight = 21.sp), color = Forest)
    }
}
