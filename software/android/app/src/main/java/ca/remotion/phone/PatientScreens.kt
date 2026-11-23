package ca.remotion.phone

import androidx.compose.animation.AnimatedContent
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
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

/** The signed-in patient's first name, for "Good morning, Elena" and "Well done, Elena". */
val LocalFirstName = staticCompositionLocalOf { "" }

/** Which screen the patient is on. Done carries its session so it can still be drawn while fading out. */
private sealed interface Screen {
    data class Done(val done: PastSession) : Screen
    data object PlugIn : Screen
    data object Session : Screen
    data object Home : Screen
    data object Setup : Screen
}

@Composable
fun PatientApp(s: UiState, past: List<PastSession>, finished: PastSession?, actions: PatientActions) {
    val warm = s.sessionRunning && s.feedback && s.leaning
    val wall by animateColorAsState(if (warm) WarmWall else Wall, tween(STATE_MS * 2), label = "wall")
    // getting set up comes before every session: "I'm ready" moves on to "Press the yellow button"
    var ready by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(s.sessionRunning) { if (s.sessionRunning) ready = false }
    LaunchedEffect(s.connected) { if (s.connected == null) ready = false }        // unplugged: set up again
    val screen = when {
        finished != null -> Screen.Done(finished)
        s.connected == null -> Screen.PlugIn
        s.sessionRunning -> Screen.Session
        !ready -> Screen.Setup
        else -> Screen.Home
    }
    Row(Modifier.fillMaxSize().background(Plaster)) {
        Column(
            Modifier.weight(2f).fillMaxHeight().drawBehind { drawRect(wall) }       // read while drawing: no recomposition per frame
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Start + WindowInsetsSides.Vertical))
                .padding(start = 32.dp, end = 28.dp, top = 24.dp, bottom = 20.dp),
        ) {
            AnimatedContent(screen, transitionSpec = { fadeThrough() }, contentKey = { it::class }, label = "coach") { shown ->
                Column(Modifier.fillMaxSize()) {
                    when (shown) {
                        is Screen.Done -> DoneCoach(shown.done, actions.onDone)
                        Screen.PlugIn -> PlugInCoach(s.message, actions.onConnect)
                        Screen.Session -> SessionCoach(s, warm)
                        Screen.Home -> HomeCoach(s)
                        Screen.Setup -> {
                            val e = LocalExercise.current
                            key(e) { SetupCoach(e, onReady = { ready = true }) }      // a new choice starts its drawing over
                        }
                    }
                }
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
            AnimatedContent(if (screen == Screen.PlugIn) Screen.Home else screen,         // the week shows on both
                transitionSpec = { fadeThrough() }, contentKey = { it::class }, label = "score") { shown ->
                Column(Modifier.fillMaxSize()) {
                    when (shown) {
                        is Screen.Done -> DoneScore(shown.done, past)
                        Screen.Session -> SessionScore(s, actions)
                        Screen.Setup -> ExercisePicker(LocalExercise.current, actions.onChooseExercise)
                        else -> WeekScore(past)
                    }
                }
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
    val onChooseExercise: (Exercise) -> Unit,
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
        Text("After that, the phone follows along by itself.", style = CoachSubStyle, color = Forest,
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
    // once Connect has failed, what to do about it replaces the general line (there's no room for both)
    Instruction("Plug the device into this phone",
        message ?: "Use the cable from the mat, in the phone’s charging port. The app connects by itself.")
    Spacer(Modifier.weight(1f))
    PrimaryButton(if (message == null) "Connect" else "Try again", onConnect)
}

/** What the coach is saying. restEndsAt is set while resting, for the countdown. */
private data class Say(val headline: String, val sub: String? = null, val warning: Boolean = false,
                       val restEndsAt: Long = 0, val next: String = "")

private fun say(s: UiState, warm: Boolean, e: Exercise): Say = when {
    warm -> when (e) {
        Exercise.MOUTH -> Say("Sit up straight", "You’re bending down to meet your hand. Bring your hand all the way up.", warning = true)
        Exercise.SIDEWAYS -> Say("Sit up straight", "You’re leaning to your right. Let your arm do the reaching.", warning = true)
        Exercise.FORWARD -> Say("Sit back against the chair", "You’re leaning forward. Let your arm do the reaching.", warning = true)
    }
    else -> when (s.state) {
        "CALIBRATING" -> Say("Sit up straight and stay still", "The device is learning how you sit upright. It takes 3 seconds.")
        "WAIT_HOME" -> Say("Put your hand on the white button", "Keep it there until a light comes on.")
        "CUED", "REACHING" -> when (e) {
            Exercise.MOUTH -> Say("Lift your hand up to your mouth",
                if (s.feedback) "Keep your head up. The buzzer sounds if you bend down." else "Keep your head up and your back straight.")
            Exercise.SIDEWAYS -> Say(
                if (s.target.isEmpty()) "Reach out to your right for the light" else "Reach out to your right for the ${s.target.lowercase()} button",
                if (s.feedback) "The buzzer sounds if you lean to the right." else "Keep your back straight against the chair.",
            )
            Exercise.FORWARD -> Say(
                if (s.target.isEmpty()) "Reach for the button that lights up" else "Reach for the ${s.target.lowercase()} button",
                if (s.feedback) "The buzzer sounds if you lean forward." else "Keep your back against the chair.",
            )
        }
        "RETURNING" -> Say(if (e == Exercise.MOUTH) "Bring your hand back down to the white button" else "Bring your hand back to the white button")
        "REST" -> Say("Rest for a moment", restEndsAt = s.restEndsAt, next = s.nextBlock)
        else -> Say("Getting ready")
    }
}

@Composable
private fun ColumnScope.SessionCoach(s: UiState, warm: Boolean) {
    // a new instruction crossfades in; the same one (CUED then REACHING) stays put
    AnimatedContent(say(s, warm, LocalExercise.current), transitionSpec = { swap() }, contentKey = { it.headline }, label = "instruction") { said ->
        Column {
            if (said.warning) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ResultIcon(upright = false, size = 44.dp)
                    Spacer(Modifier.width(14.dp))
                    Text(said.headline, style = CoachStyle, color = Forest, maxLines = 2,
                        modifier = Modifier.semantics { heading(); liveRegion = LiveRegionMode.Assertive })
                }
                Text(said.sub!!, style = CoachSubStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
            } else if (said.restEndsAt > 0) {
                val left by produceState(secondsLeft(said.restEndsAt), said.restEndsAt) {
                    while (value > 0) { delay(1000); value = secondsLeft(said.restEndsAt) }
                }
                Instruction(said.headline, "Next: ${blockName(said.next).lowercase()}" + if (left > 0) ", in $left seconds." else ".")
            } else {
                Instruction(said.headline, said.sub)
            }
        }
    }
    Spacer(Modifier.weight(1f))
    if (s.state != "CALIBRATING" && s.state != "REST") Mat(s)
}

@Composable
private fun ColumnScope.DoneCoach(done: PastSession, onDone: () -> Unit) {
    Instruction("Well done, ${LocalFirstName.current}", "You finished ${done.reaches} ${done.exercise.reps(done.reaches)}. Your results are on the right, and your therapist can see them too.")
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
        if (LocalExercise.current != Exercise.MOUTH) {            // hand to mouth has no target to press
            MatButton("Green", ButtonGreen, lit == "GREEN")
            MatButton("Blue", ButtonBlue, lit == "BLUE")
            MatButton("Red", ButtonRed, lit == "RED")
        }
    }
}

@Composable
private fun MatButton(name: String, color: Color, lit: Boolean) {
    // the light comes on and goes off like the real one: a quick fade, not a jump
    val fill by animateColorAsState(if (lit) color else Wall, tween(STATE_MS), label = "fill")
    val ring by animateColorAsState(if (lit) Forest else Color.Transparent, tween(STATE_MS), label = "ring")
    val edge by animateColorAsState(if (lit) Forest else Forest2.copy(alpha = 0.55f), tween(STATE_MS), label = "edge")
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(46.dp).border(2.5.dp, ring, CircleShape).padding(5.dp)
                .clip(CircleShape).drawBehind { drawRect(fill) }
                .border(if (lit) 2.dp else 1.5.dp, edge, CircleShape),
        )
        Text(name, style = LabelStyle.copy(fontSize = 15.sp, fontWeight = if (lit) FontWeight.Bold else FontWeight.Normal),
            color = Forest, modifier = Modifier.padding(top = 4.dp))
    }
}

// ---------------------------------------------------------------- the scoreboard (right)

/*
  This week, as a count and a track. The count leads ("3 days practised"); under it the seven
  days sit on one hairline, Monday to Sunday: a practised day is a filled forest mark with a
  tick, today (not yet done) an open eucalyptus ring, a day gone by a small dot, a day still
  to come a fainter one. Nothing is red or missing-looking: this is about showing up.
*/
@Composable
private fun ColumnScope.WeekScore(past: List<PastSession>) {
    val week = History.week(past)
    val today = LocalDate.now()
    val days = week.count { it.second }
    Text("This week", style = LabelStyle, color = Forest2)
    if (days > 0) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = 40.sp, fontFeatureSettings = "tnum")) { append("$days") }
                append(if (days == 1) " day practised" else " days practised")
            },
            style = BodyStyle.copy(lineHeight = 44.sp), color = Forest, modifier = Modifier.padding(top = 2.dp),
        )
    } else if (past.isNotEmpty()) {
        Text("No practice yet this week", style = BodyStyle, color = Forest, modifier = Modifier.padding(top = 6.dp))
    }
    WeekTrack(week, today, Modifier.padding(top = 14.dp))
    if (past.isNotEmpty()) {
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Wall))
        Text(lastTime(past), style = BodyStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
    }
}

private val DAY_INITIAL = 20.dp
private val TRACK_GAP = 8.dp
private val MARK = 28.dp

@Composable
private fun WeekTrack(week: List<Pair<LocalDate, Boolean>>, today: LocalDate, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().drawBehind {
            // the hairline the days sit on, from Monday's mark to Sunday's
            val y = (DAY_INITIAL + TRACK_GAP + MARK / 2).toPx()
            val step = size.width / 7
            drawLine(Wall, Offset(step / 2, y), Offset(size.width - step / 2, y), strokeWidth = 1.5.dp.toPx())
        },
    ) {
        week.forEach { (day, done) ->
            val isToday = day == today
            Column(
                Modifier.weight(1f).semantics(mergeDescendants = true) {
                    contentDescription = day.dayOfWeek.name.lowercase().replaceFirstChar { it.uppercase() } +
                        (if (isToday) ", today" else "") + if (done) ", practised" else ""
                },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(day.dayOfWeek.name.take(1), style = LabelStyle.copy(fontSize = 15.sp),
                    color = if (isToday || done) Forest else Forest2, modifier = Modifier.height(DAY_INITIAL))
                Spacer(Modifier.height(TRACK_GAP))
                Box(Modifier.size(MARK), contentAlignment = Alignment.Center) {
                    when {
                        done -> Box(Modifier.size(MARK).clip(CircleShape).background(Forest), contentAlignment = Alignment.Center) {
                            CheckMark(Plaster, 15.dp)
                        }
                        isToday -> Box(Modifier.size(MARK).clip(CircleShape).background(Plaster).border(2.dp, Eucalyptus, CircleShape))
                        day.isBefore(today) -> Box(Modifier.size(8.dp).clip(CircleShape).background(Forest2.copy(alpha = 0.45f)))
                        else -> Box(Modifier.size(6.dp).clip(CircleShape).background(Wall))
                    }
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.SessionScore(s: UiState, actions: PatientActions) {
    // the buttons stay at the bottom; with large system text the rest scrolls rather than pushing them off
    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
    Text(blockName(s.phase), style = LabelStyle.copy(fontSize = 20.sp), color = Forest)
    Text(if (s.state == "REST") "Finished. Well done." else blockLine(s.phase), style = BodyStyle.copy(fontSize = 16.sp), color = Forest2)
    if (s.blockSize > 0) {
        val now = (s.blockDone + if (s.state in listOf("WAIT_HOME", "CUED", "REACHING")) 1 else 0).coerceIn(1, s.blockSize)
        val e = LocalExercise.current
        AnimatedContent(now to s.blockSize, transitionSpec = { swap() }, label = "count") { (n, of) ->
            Text(
                buildAnnotatedString {
                    append("$n")
                    withStyle(SpanStyle(fontSize = 20.sp, fontWeight = FontWeight.Normal, color = Forest2)) { append(" of $of ${e.many}") }
                },
                style = NumberStyle, color = Forest, modifier = Modifier.padding(top = 8.dp).semantics { contentDescription = "${e.one.replaceFirstChar { it.uppercase() }} $n of $of" },
            )
        }
    }
    Spacer(Modifier.height(10.dp))
    val shownRep = s.lastRep.takeIf { s.feedback && it?.phase == "TRAINING" }
    AnimatedContent(shownRep, transitionSpec = { swap() }, contentKey = { it?.rep }, label = "last reach") { rep ->
        if (rep != null) LastReach(rep, s.blockUpright, s.blockDone)
    }
    if (shownRep == null && (s.phase == "BASELINE" || s.phase == "POST")) {
        Text("Your results come at the end.", style = BodyStyle.copy(fontSize = 16.sp), color = Forest2)
    }
    }
    if (s.demo) TextButton(onClick = actions.onAddReach, enabled = s.state == "WAIT_HOME", modifier = Modifier.fillMaxWidth()) {
        Text("Add a ${LocalExercise.current.one} (demo)", fontSize = 16.sp)
    }
    if (s.oldFirmware) Text("To stop, press the yellow button.", style = BodyStyle.copy(fontSize = 16.sp), color = Forest)
    else OutlinedButton(onClick = actions.onEnd, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
        Text("End session", fontSize = 17.sp, color = Forest)
    }
}

/** The last reach of the training block: icon and word, never colour alone. */
@Composable
private fun LastReach(rep: Rep, upright: Int, done: Int) {
    val up = !rep.compensated
    Row(
        Modifier.fillMaxWidth().shadow(6.dp, RoundedCornerShape(14.dp), ambientColor = Forest, spotColor = Forest)
            .clip(RoundedCornerShape(14.dp)).background(Panel).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ResultIcon(upright = up, size = 30.dp)
        Column(Modifier.padding(start = 10.dp)) {
            Text(if (up) "Upright" else "Leaned", style = LabelStyle.copy(fontSize = 19.sp), color = if (up) Forest else TerraDeep)
            Text("Last ${LocalExercise.current.one} · ${of(upright, done)} upright", style = BodyStyle.copy(fontSize = 15.sp, fontFeatureSettings = "tnum"), color = Forest)
        }
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
    Text("${done.exercise.many} upright", style = BodyStyle, color = Forest)
    val leaned = done.reaches - done.upright
    if (leaned > 0) Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
        ResultIcon(upright = false, size = 22.dp)
        Text("$leaned " + when (done.exercise) {
            Exercise.MOUTH -> "bent down"
            Exercise.SIDEWAYS -> "leaned to the right"
            Exercise.FORWARD -> "leaned forward"
        }, style = BodyStyle.copy(fontFeatureSettings = "tnum"), color = TerraDeep, modifier = Modifier.padding(start = 8.dp))
    }
    // the session just ended is already the last one; compare with the same exercise only
    val before = past.dropLast(1).lastOrNull { it.exercise == done.exercise }
    if (before != null) {
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Wall))
        Text(compare(done, before), style = BodyStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
    }
}

/*
  Before a session, the right side is the choice of exercise: three large rows, one chosen,
  remembered for next time. A radio group: the whole row is the target, the mark is never
  colour alone (filled with a tick, or an empty ring).
*/
@Composable
private fun ColumnScope.ExercisePicker(chosen: Exercise, onChoose: (Exercise) -> Unit) {
    Text("Today’s exercise", style = LabelStyle, color = Forest2, modifier = Modifier.semantics { heading() })
    Column(
        Modifier.padding(top = 10.dp).weight(1f).verticalScroll(rememberScrollState()).selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Exercise.entries.forEach { e -> ExerciseRow(e, e == chosen) { onChoose(e) } }
    }
}

@Composable
private fun ExerciseRow(e: Exercise, chosen: Boolean, onClick: () -> Unit) {
    val edge by animateColorAsState(if (chosen) Forest else Wall, tween(STATE_MS), label = "edge")
    val fill by animateColorAsState(if (chosen) Panel else Plaster, tween(STATE_MS), label = "fill")
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 64.dp).clip(shape).background(fill).border(if (chosen) 2.dp else 1.dp, edge, shape)
            .selectable(selected = chosen, onClick = onClick, role = Role.RadioButton)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(26.dp).clip(CircleShape).background(if (chosen) Forest else Plaster)
            .border(if (chosen) 0.dp else 2.dp, Forest2.copy(alpha = 0.6f), CircleShape), contentAlignment = Alignment.Center) {
            if (chosen) CheckMark(Plaster, 14.dp)
        }
        Column(Modifier.padding(start = 12.dp)) {
            Text(e.title, style = LabelStyle.copy(fontSize = 18.sp, lineHeight = 22.sp), color = Forest)
            Text(e.blurb, style = BodyStyle.copy(fontSize = 14.sp, lineHeight = 18.sp), color = Forest2)
        }
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

@Composable
private fun greeting(): String {
    val h = LocalTime.now().hour
    val part = if (h < 12) "Good morning" else if (h < 17) "Good afternoon" else "Good evening"
    return "$part, ${LocalFirstName.current}"
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
    "PRACTICE" -> "Practice goes. These don’t count."
    "BASELINE" -> "Reach the way you normally do."
    "TRAINING" -> "The buzzer sounds if you lean."
    "POST" -> "No buzzer this time."
    else -> "Sit up straight and still."
}


/** "3 of 4" that never breaks across lines. */
private fun of(a: Int, b: Int) = "$a\u00A0of\u00A0$b"

/** How the last session went, and the one before. Only called once there is one. */
private fun lastTime(past: List<PastSession>): String {
    val last = past.last()
    val before = past.dropLast(1).lastOrNull { it.exercise == last.exercise }
    val line = "Last time you stayed upright in ${of(last.upright, last.reaches)} ${last.exercise.reps(last.reaches)}."
    return if (before == null) line else "$line " + compare(last, before)
}

/** Only ever encouraging: "up from" when it went better, otherwise just the time before. */
private fun compare(now: PastSession, before: PastSession): String {
    val better = before.reaches > 0 && now.reaches > 0 &&
        now.upright.toFloat() / now.reaches > before.upright.toFloat() / before.reaches
    return if (better) "Up from ${of(before.upright, before.reaches)} the time before."
    else "The time before: ${of(before.upright, before.reaches)}."
}
