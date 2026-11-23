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
  Start, which sets the device's plan and starts the session at once (calibration first, so
  the person should already be sitting upright and still). Works with the demo device too.
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

@Composable
fun DemoScreen(s: UiState, login: Login?, exercise: Exercise, onStart: (List<Int>) -> Unit, onEnd: () -> Unit,
               onDemoDevice: () -> Unit, onBack: () -> Unit) {
    val ready = s.connected != null && !s.sessionRunning
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
            Text("Start begins with 3 s of calibration straight away, so sit upright and still, with the chest and wrist sensors on, before you tap it. " +
                "The device keeps the demo’s plan afterwards, so pressing the yellow button runs it again; Full session puts the real plan back.",
                style = BodyStyle.copy(fontSize = 15.sp, lineHeight = 21.sp), color = Forest2, modifier = Modifier.padding(top = 4.dp))
        }

        // ---- right: the demos
        Column(Modifier.weight(1.15f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (s.sessionRunning) {
                Row(Modifier.fillMaxWidth().background(Wash, RoundedCornerShape(12.dp)).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("A session is running.", style = BodyStyle, color = Forest, modifier = Modifier.weight(1f))
                    OutlinedButton(onClick = onEnd) { Text("End it") }
                }
            }
            DEMOS.forEach { d -> DemoCard(d, current = s.plan == d.plan, enabled = ready) { onStart(d.plan) } }
        }
    }
}

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
