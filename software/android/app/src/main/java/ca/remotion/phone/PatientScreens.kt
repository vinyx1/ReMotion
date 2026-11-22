package ca.remotion.phone

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalTime

/*
  The patient's app: one screen, split like a rehab room. The left two thirds is the coach,
  on the eucalyptus wall: one instruction at a time, in words big enough to read from the
  far side of the table, and a drawing of the mat showing which button is lit. The right
  third is the scoreboard, on plaster: where they are in the session, and, between
  sessions, their week and how last time went.

  Feedback on leaning (the warm wall, "Sit back", Upright / Leaned) only appears in the
  training block: baseline and post measure how the patient reaches without it.
*/

private val FirstName = MainViewModel.PATIENT_NAME.substringBefore(' ')

@Composable
fun PatientApp(s: UiState, past: List<PastSession>, finished: PastSession?, actions: PatientActions) {
    val warm = s.sessionRunning && s.feedback && s.leaning
    val wall by animateColorAsState(if (warm) WarmWall else Wall, tween(300), label = "wall")
    Row(Modifier.fillMaxSize().background(Plaster)) {
        Column(
            Modifier.weight(2f).fillMaxHeight().background(wall)
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Start + WindowInsetsSides.Vertical))
                .padding(start = 32.dp, end = 28.dp, top = 24.dp, bottom = 20.dp),
        ) {
            when {
                finished != null -> DoneCoach(finished, actions.onDone)
                s.connected == null -> PlugInCoach(s.message, actions.onConnect)
                s.sessionRunning -> SessionCoach(s, warm)
                else -> HomeCoach(s)
            }
        }
        Column(
            Modifier.weight(1f).fillMaxHeight()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.End + WindowInsetsSides.Vertical))
                .padding(start = 24.dp, end = 20.dp, top = 12.dp, bottom = 16.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = actions.onSettings, contentPadding = PaddingValues(horizontal = 10.dp)) {
                    Text("Settings", fontSize = 15.sp, color = Forest2)
                }
            }
            when {
                finished != null -> DoneScore(finished, past)
                s.sessionRunning -> SessionScore(s, actions)
                else -> WeekScore(past)
            }
        }
    }
}

class PatientActions(
    val onConnect: () -> Unit,
    val onEnd: () -> Unit,
    val onDone: () -> Unit,
    val onSettings: () -> Unit,
    val onAddReach: () -> Unit,
)

// ---------------------------------------------------------------- the coach (left)

@Composable
private fun Instruction(text: String, sub: String? = null) {
    Text(text, style = CoachStyle, color = Forest, maxLines = 3,
        modifier = Modifier.semantics { heading(); liveRegion = LiveRegionMode.Polite })
    if (sub != null) Text(sub, style = CoachSubStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun ColumnScope.HomeCoach(s: UiState) {
    Text(greeting(), style = LabelStyle.copy(fontSize = 19.sp), color = Forest)
    Spacer(Modifier.height(10.dp))
    Text("Press the yellow button on the mat to start", style = CoachStyle, color = Forest, maxLines = 3,
        modifier = Modifier.semantics { heading() })
    Spacer(Modifier.weight(1f))
    Row(verticalAlignment = Alignment.CenterVertically) {
        // the START button as it looks on the table
        Box(Modifier.size(52.dp).shadow(3.dp, CircleShape).clip(CircleShape).background(ButtonYellow).border(3.dp, Forest, CircleShape))
        Text("The phone follows along by itself. Nothing to tap.", style = CoachSubStyle, color = Forest,
            modifier = Modifier.padding(start = 16.dp))
    }
    Spacer(Modifier.height(14.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(Eucalyptus))
        Text(if (s.demo) "Demo device connected" else "Device connected", style = LabelStyle, color = Forest,
            modifier = Modifier.padding(start = 8.dp))
    }
}

@Composable
private fun ColumnScope.PlugInCoach(message: String?, onConnect: () -> Unit) {
    Text(greeting(), style = LabelStyle.copy(fontSize = 19.sp), color = Forest)
    Spacer(Modifier.height(10.dp))
    Instruction("Plug the device into this phone", "Use the cable from the mat, in the phone’s charging port. The app connects by itself.")
    Spacer(Modifier.weight(1f))
    if (message != null) Text(message, style = BodyStyle, color = Forest, modifier = Modifier.padding(bottom = 12.dp))
    PrimaryButton("Connect", onConnect)
}

@Composable
private fun ColumnScope.SessionCoach(s: UiState, warm: Boolean) {
    if (warm) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            ResultIcon(upright = false, size = 44.dp)
            Spacer(Modifier.width(14.dp))
            Text("Sit back against the chair", style = CoachStyle, color = Forest, maxLines = 2,
                modifier = Modifier.semantics { heading(); liveRegion = LiveRegionMode.Assertive })
        }
        Text("You’re leaning forward. Let your arm do the reaching.", style = CoachSubStyle, color = Forest,
            modifier = Modifier.padding(top = 12.dp))
    } else when (s.state) {
        "CALIBRATING" -> Instruction("Sit up straight and stay still", "The device is learning how you sit upright. It takes 3 seconds.")
        "WAIT_HOME" -> Instruction("Put your hand on the white button", "Keep it there until a light comes on.")
        "CUED", "REACHING" -> Instruction(
            if (s.target.isEmpty()) "Reach for the button that lights up" else "Reach for the ${s.target.lowercase()} button",
            if (s.feedback) "The buzzer sounds if you lean forward." else "Keep your back against the chair.",
        )
        "RETURNING" -> Instruction("Bring your hand back to the white button")
        "REST" -> {
            val left by produceState(secondsLeft(s.restEndsAt), s.restEndsAt) {
                while (value > 0) { delay(1000); value = secondsLeft(s.restEndsAt) }
            }
            Instruction("Rest for a moment", "Next: ${blockName(s.nextBlock).lowercase()}" + if (left > 0) ", in $left seconds." else ".")
        }
        else -> Instruction("Getting ready")
    }
    Spacer(Modifier.weight(1f))
    if (s.state != "CALIBRATING" && s.state != "REST") Mat(s)
}

@Composable
private fun ColumnScope.DoneCoach(done: PastSession, onDone: () -> Unit) {
    Instruction("Well done, $FirstName", "You finished ${done.reaches} ${if (done.reaches == 1) "reach" else "reaches"}. Your results are on the right, and your therapist can see them too.")
    Spacer(Modifier.weight(1f))
    PrimaryButton("Done", onDone)
}

/** The mat seen from the patient's chair: HOME (white) and the three targets; the lit one is drawn lit. */
@Composable
private fun Mat(s: UiState) {
    val lit = when (s.state) {
        "WAIT_HOME", "RETURNING" -> "HOME"
        "CUED", "REACHING" -> s.target
        else -> ""
    }
    Row(
        Modifier.clip(RoundedCornerShape(14.dp)).background(Wash).border(1.5.dp, Eucalyptus, RoundedCornerShape(14.dp))
            .padding(horizontal = 18.dp, vertical = 10.dp)
            .semantics { contentDescription = if (lit.isEmpty()) "The mat" else "On the mat, the ${lit.lowercase()} button is lit" },
        horizontalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        MatButton("Home", Panel, lit == "HOME")
        MatButton("Green", ButtonGreen, lit == "GREEN")
        MatButton("Blue", ButtonBlue, lit == "BLUE")
        MatButton("Red", ButtonRed, lit == "RED")
    }
}

@Composable
private fun MatButton(name: String, color: Color, lit: Boolean) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(46.dp).border(if (lit) 2.5.dp else 0.dp, if (lit) Forest else Color.Transparent, CircleShape).padding(5.dp)
                .clip(CircleShape).background(if (lit) color else Wall)
                .border(if (lit) 2.dp else 1.5.dp, if (lit) Forest else Forest2.copy(alpha = 0.55f), CircleShape),
        )
        Text(name, style = LabelStyle.copy(fontSize = 15.sp, fontWeight = if (lit) FontWeight.Bold else FontWeight.Normal),
            color = Forest, modifier = Modifier.padding(top = 4.dp))
    }
}

// ---------------------------------------------------------------- the scoreboard (right)

@Composable
private fun ColumnScope.WeekScore(past: List<PastSession>) {
    val week = History.week(past)
    val today = LocalDate.now()
    Text("This week", style = LabelStyle, color = Forest2)
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        week.forEach { (day, done) ->
            val isToday = day == today
            Column(
                Modifier.weight(1f).height(54.dp).clip(RoundedCornerShape(9.dp))
                    .background(if (done) Forest else Panel)
                    .border(if (isToday) 2.5.dp else 1.dp, if (isToday || done) Forest else Wall, RoundedCornerShape(9.dp))
                    .semantics(mergeDescendants = true) {
                        contentDescription = day.dayOfWeek.name.lowercase().replaceFirstChar { it.uppercase() } +
                            (if (isToday) ", today" else "") + if (done) ", practised" else ""
                    },
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.SpaceEvenly,
            ) {
                Text(day.dayOfWeek.name.take(1), style = LabelStyle.copy(fontSize = 14.sp), color = if (done) Plaster else Forest)
                if (done) CheckMark(Plaster, 16.dp) else Spacer(Modifier.height(16.dp))
            }
        }
    }
    val days = week.count { it.second }
    Text(
        buildAnnotatedString {
            if (days == 0) append("No practice yet this week")
            else {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = 26.sp, fontFeatureSettings = "tnum")) { append("$days") }
                append(if (days == 1) " day practised" else " days practised")
            }
        },
        style = BodyStyle, color = Forest, modifier = Modifier.padding(top = 10.dp),
    )
    Spacer(Modifier.weight(1f))
    Box(Modifier.fillMaxWidth().height(1.dp).background(Wall))
    Text(lastTime(past), style = BodyStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun ColumnScope.SessionScore(s: UiState, actions: PatientActions) {
    Text(blockName(s.phase), style = LabelStyle.copy(fontSize = 20.sp), color = Forest)
    Text(if (s.state == "REST") "Finished. Well done." else blockLine(s.phase), style = BodyStyle.copy(fontSize = 16.sp), color = Forest2)
    if (s.blockSize > 0) {
        val now = (s.blockDone + if (s.state in listOf("WAIT_HOME", "CUED", "REACHING")) 1 else 0).coerceIn(1, s.blockSize)
        Text(
            buildAnnotatedString {
                append("$now")
                withStyle(SpanStyle(fontSize = 20.sp, fontWeight = FontWeight.Normal, color = Forest2)) { append(" of ${s.blockSize} reaches") }
            },
            style = NumberStyle, color = Forest, modifier = Modifier.padding(top = 8.dp).semantics { contentDescription = "Reach $now of ${s.blockSize}" },
        )
    }
    Spacer(Modifier.height(10.dp))
    if (s.feedback && s.lastRep?.phase == "TRAINING") {
        val up = !s.lastRep.compensated
        Row(
            Modifier.fillMaxWidth().shadow(6.dp, RoundedCornerShape(14.dp), ambientColor = Forest, spotColor = Forest)
                .clip(RoundedCornerShape(14.dp)).background(Panel).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ResultIcon(upright = up, size = 30.dp)
            Column(Modifier.padding(start = 10.dp)) {
                Text(if (up) "Upright" else "Leaned", style = LabelStyle.copy(fontSize = 19.sp), color = if (up) Forest else TerraDeep)
                Text("Last reach · ${s.blockUpright} of ${s.blockDone} upright", style = BodyStyle.copy(fontSize = 15.sp, fontFeatureSettings = "tnum"), color = Forest)
            }
        }
    } else if (s.phase == "BASELINE" || s.phase == "POST") {
        Text("Your results come at the end.", style = BodyStyle.copy(fontSize = 16.sp), color = Forest2)
    }
    Spacer(Modifier.weight(1f))
    if (s.demo) TextButton(onClick = actions.onAddReach, enabled = s.state == "WAIT_HOME", modifier = Modifier.fillMaxWidth()) {
        Text("Add a reach (demo)", fontSize = 16.sp)
    }
    if (s.oldFirmware) Text("To stop, press the yellow button.", style = BodyStyle.copy(fontSize = 16.sp), color = Forest)
    else OutlinedButton(onClick = actions.onEnd, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
        Text("End session", fontSize = 17.sp, color = Forest)
    }
}

@Composable
private fun ColumnScope.DoneScore(done: PastSession, past: List<PastSession>) {
    Text("Today", style = LabelStyle, color = Forest2)
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
        ResultIcon(upright = true, size = 30.dp)
        Text(
            buildAnnotatedString {
                append("${done.upright}")
                withStyle(SpanStyle(fontSize = 20.sp, fontWeight = FontWeight.Normal, color = Forest2)) { append(" of ${done.reaches}") }
            },
            style = NumberStyle, color = Forest, modifier = Modifier.padding(start = 10.dp),
        )
    }
    Text("reaches upright", style = BodyStyle, color = Forest)
    val leaned = done.reaches - done.upright
    if (leaned > 0) Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
        ResultIcon(upright = false, size = 22.dp)
        Text("$leaned leaned forward", style = BodyStyle.copy(fontFeatureSettings = "tnum"), color = TerraDeep, modifier = Modifier.padding(start = 8.dp))
    }
    val before = past.dropLast(1).lastOrNull()       // the session just ended is already the last one
    if (before != null) {
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Wall))
        Text(compare(done, before), style = BodyStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
    }
}

// ---------------------------------------------------------------- pieces

@Composable
fun PrimaryButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick, shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Forest, contentColor = Plaster),
        contentPadding = PaddingValues(horizontal = 28.dp, vertical = 12.dp),
        modifier = modifier.heightIn(min = 56.dp),
    ) { Text(label, style = LabelStyle.copy(fontSize = 19.sp, lineHeight = 26.sp)) }
}

/** A circle with a tick (upright) or a cross (leaned): never colour alone. */
@Composable
fun ResultIcon(upright: Boolean, size: Dp) {
    val color = if (upright) Forest else Terra
    Canvas(Modifier.size(size)) {
        val w = this.size.minDimension
        val stroke = w * 0.09f
        drawCircle(color, radius = w / 2 - stroke / 2, style = Stroke(stroke))
        val p = Path()
        if (upright) {
            p.moveTo(w * 0.30f, w * 0.52f); p.lineTo(w * 0.45f, w * 0.66f); p.lineTo(w * 0.70f, w * 0.36f)
        } else {
            p.moveTo(w * 0.34f, w * 0.34f); p.lineTo(w * 0.66f, w * 0.66f)
            p.moveTo(w * 0.66f, w * 0.34f); p.lineTo(w * 0.34f, w * 0.66f)
        }
        drawPath(p, color, style = Stroke(stroke, cap = StrokeCap.Round))
    }
}

@Composable
private fun CheckMark(color: Color, size: Dp) {
    Canvas(Modifier.size(size)) {
        val w = this.size.minDimension
        val p = Path().apply { moveTo(w * 0.15f, w * 0.55f); lineTo(w * 0.40f, w * 0.78f); lineTo(w * 0.85f, w * 0.25f) }
        drawPath(p, color, style = Stroke(w * 0.16f, cap = StrokeCap.Round))
    }
}

private fun greeting(): String {
    val h = LocalTime.now().hour
    val part = if (h < 12) "Good morning" else if (h < 17) "Good afternoon" else "Good evening"
    return "$part, $FirstName"
}

private fun secondsLeft(until: Long) = ((until - System.currentTimeMillis() + 999) / 1000).toInt().coerceAtLeast(0)

/** The blocks in the patient's words. */
private fun blockName(phase: String) = when (phase) {
    "PRACTICE" -> "Warm-up"
    "BASELINE" -> "On your own"
    "TRAINING" -> "With the buzzer"
    "POST" -> "On your own again"
    else -> "Getting ready"
}

private fun blockLine(phase: String) = when (phase) {
    "PRACTICE" -> "Practice reaches. These don’t count."
    "BASELINE" -> "Reach the way you normally do."
    "TRAINING" -> "The buzzer sounds if you lean."
    "POST" -> "No buzzer this time."
    else -> "Sit up straight and still."
}

private fun reaches(n: Int) = if (n == 1) "reach" else "reaches"

/** "3 of 4" that never breaks across lines. */
private fun of(a: Int, b: Int) = "$a\u00A0of\u00A0$b"

private fun lastTime(past: List<PastSession>): String {
    val last = past.lastOrNull() ?: return "After your first session, how it went shows up here."
    val before = past.dropLast(1).lastOrNull()
    val line = "Last time you stayed upright in ${of(last.upright, last.reaches)} ${reaches(last.reaches)}."
    return if (before == null) line else "$line " + compare(last, before)
}

/** Only ever encouraging: "up from" when it went better, otherwise just the time before. */
private fun compare(now: PastSession, before: PastSession): String {
    val better = before.reaches > 0 && now.reaches > 0 &&
        now.upright.toFloat() / now.reaches > before.upright.toFloat() / before.reaches
    return if (better) "Up from ${of(before.upright, before.reaches)} the time before."
    else "The time before: ${of(before.upright, before.reaches)}."
}
