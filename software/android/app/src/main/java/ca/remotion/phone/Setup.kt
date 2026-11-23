package ca.remotion.phone

import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.EaseInOutCubic
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
  Before each session: getting set up, then "I'm ready". The mat's START button begins the
  3-second calibration at once, so the setting up has to come before it, not after.

  A drawing builds the scene in the order the patient does it, in the intro's figure style:
  the phone stands up against a book, the mat slides in on the table, the chest strap wraps
  on. Then the arm shows the movement once (out to the button, or up to the mouth) and back.
  Each step's line lights as its part moves, the finished scene holds, the three parts fade,
  and it plays again (6.4 s a loop). Forward reach and hand to mouth are seen from the side;
  the sideways reach from the front, where the mat turned along the table edge reads. With
  animations off, the finished scene and all three steps show, still.
*/

private fun steps(e: Exercise) = listOf(
    "Prop the phone up, facing you",
    if (e == Exercise.SIDEWAYS) "Turn the mat along the table edge, by your reaching hand" else "Put the mat on the table in front of you",
    "Put on the chest strap",
)

// the loop, in ms: each part moves for MOVE, then waits for the next; the finished scene holds; the parts fade
private const val STEP = 1500f
private const val MOVE = 700f
private const val HOLD_END = 3 * STEP + 1600f
private const val LOOP = HOLD_END + 400f

@Composable
fun ColumnScope.SetupCoach(exercise: Exercise, onReady: () -> Unit) {
    val context = LocalContext.current
    val reduced = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val clock: State<Float> = if (reduced) remember { mutableFloatStateOf(HOLD_END - 1f) }
        else rememberInfiniteTransition(label = "setup").animateFloat(
            0f, LOOP, infiniteRepeatable(tween(LOOP.toInt(), easing = LinearEasing)), label = "clock",
        )
    // which step is being shown (-1: all of them, the finished scene)
    val step by remember { derivedStateOf { if (reduced || clock.value >= 3 * STEP) -1 else (clock.value / STEP).toInt() } }

    Text("Get set up", style = CoachStyle, color = Forest, modifier = Modifier.semantics { heading() })
    Spacer(Modifier.height(12.dp))
    Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        Canvas(
            Modifier.weight(1f).aspectRatio(300f / 180f).align(Alignment.CenterVertically)
                .semantics { contentDescription = "A drawing: the phone propped up on the table, the mat " +
                    (if (exercise == Exercise.SIDEWAYS) "along the table edge" else "in front of you") + ", the chest strap on." },
        ) { if (exercise == Exercise.SIDEWAYS) frontScene(clock.value) else sideScene(clock.value, exercise) }
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically)) {
            steps(exercise).forEachIndexed { i, text -> StepLine(i + 1, text, lit = step == -1 || step == i) }
            Spacer(Modifier.height(6.dp))
            PrimaryButton("I’m ready", onReady, Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun StepLine(n: Int, text: String, lit: Boolean) {
    val ink by animateColorAsState(if (lit) Forest else Forest2.copy(alpha = 0.6f), tween(STATE_MS * 2), label = "ink")
    val disc by animateColorAsState(if (lit) Forest else Wall, tween(STATE_MS * 2), label = "disc")
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(30.dp).background(disc, CircleShape).border(1.5.dp, ink, CircleShape), contentAlignment = Alignment.Center) {
            Text("$n", style = LabelStyle.copy(fontSize = 16.sp), color = if (lit) Plaster else ink)
        }
        Spacer(Modifier.width(12.dp))
        Text(text, style = CoachSubStyle.copy(fontSize = 19.sp, lineHeight = 23.sp, fontWeight = if (lit) FontWeight.Bold else FontWeight.Normal), color = ink)
    }
}

/** 0 → 1 over [start, start + MOVE), eased; how far one part has moved at time t. */
private fun part(t: Float, start: Float, ease: (Float) -> Float = EaseOutCubic::transform) =
    ease(((t - start) / MOVE).coerceIn(0f, 1f))

/** The arm's movement after setting up: out, a moment there, back. 0 at rest, 1 at the button or the mouth. */
private fun show(t: Float): Float {
    val at = t - (3 * STEP + 150f)
    return when {
        at <= 0f -> 0f
        at < 550f -> EaseInOutCubic.transform(at / 550f)
        at < 850f -> 1f
        at < 1400f -> 1f - EaseInOutCubic.transform((at - 850f) / 550f)
        else -> 0f
    }
}

private fun lerp(a: Offset, b: Offset, k: Float) = Offset(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)

/** Forward reach and hand to mouth, from the side, the patient facing right, on a 300 × 180 grid. */
private fun DrawScope.sideScene(t: Float, exercise: Exercise) {
    val u = size.width / 300f
    fun p(x: Float, y: Float) = Offset(x * u, y * u)
    val furniture = Forest2.copy(alpha = 0.45f)
    val fade = 1f - ((t - HOLD_END) / 400f).coerceIn(0f, 1f)          // the three parts fade before the loop restarts

    // chair, table
    drawLine(furniture, p(36f, 124f), p(92f, 124f), 6 * u, StrokeCap.Round)
    drawLine(furniture, p(36f, 124f), p(36f, 70f), 6 * u, StrokeCap.Round)
    drawLine(furniture, p(52f, 124f), p(52f, 172f), 5 * u, StrokeCap.Round)
    drawLine(furniture, p(122f, 104f), p(292f, 104f), 6 * u, StrokeCap.Round)
    drawLine(furniture, p(280f, 104f), p(280f, 172f), 5 * u, StrokeCap.Round)

    // the patient, sitting upright
    drawCircle(Forest, 11 * u, p(66f, 40f))
    drawLine(Forest, p(66f, 58f), p(66f, 114f), 14 * u, StrokeCap.Round)
    drawLine(Forest, p(66f, 116f), p(110f, 116f), 12 * u, StrokeCap.Round)
    drawLine(Forest, p(110f, 116f), p(110f, 168f), 12 * u, StrokeCap.Round)

    // 1. the phone (sideways, so short from the side) stands up and leans back against a book, screen towards the patient
    val phone = part(t, 0f, EaseInOutCubic::transform)
    drawRoundRect(furniture.copy(alpha = 0.45f * fade), p(264f, 86f), Size(14 * u, 15 * u), CornerRadius(2 * u))
    if (phone > 0f) rotate(-90f + 104f * phone, pivot = p(254f, 101f)) {
        val a = (phone * 3f).coerceAtMost(1f) * fade
        drawRoundRect(Forest.copy(alpha = a), p(250f, 65f), Size(8 * u, 36 * u), CornerRadius(2.5f * u))
        drawLine(Eucalyptus.copy(alpha = a), p(249f, 69f), p(249f, 97f), 2 * u)            // the screen's glow
    }

    // 2. the mat slides in along the table, its buttons on top
    val mat = part(t, STEP)
    if (mat > 0f) translate(left = (1f - mat) * 50 * u) {
        val a = mat * fade
        drawRoundRect(Wash.copy(alpha = a), p(142f, 94f), Size(92 * u, 8 * u), CornerRadius(3 * u))
        drawRoundRect(Eucalyptus.copy(alpha = a), p(142f, 94f), Size(92 * u, 8 * u), CornerRadius(3 * u), style = Stroke(1.5f * u))
        listOf(Panel, ButtonGreen, ButtonBlue, ButtonRed).forEachIndexed { i, c ->
            val at = p(154f + i * 22f, 93f)
            drawCircle(c.copy(alpha = a), 5 * u, at)
            drawCircle(Forest2.copy(alpha = 0.7f * a), 5 * u, at, style = Stroke(1.2f * u))
        }
    }

    // the arm: resting on the table's edge; then out to the blue button, or up to the mouth
    val k = show(t)
    val shoulder = p(66f, 66f)
    val (elbowTo, handTo) = if (exercise == Exercise.MOUTH) p(86f, 90f) to p(82f, 50f) else p(130f, 76f) to p(196f, 88f)
    val elbow = lerp(p(76f, 100f), elbowTo, k)
    val hand = lerp(p(130f, 98f), handTo, k)
    drawLine(Forest, shoulder, elbow, 9 * u, StrokeCap.Round)
    drawLine(Forest, elbow, hand, 9 * u, StrokeCap.Round)

    // 3. the chest strap wraps on around the trunk, the sensor on the front
    val strap = part(t, 2 * STEP)
    if (strap > 0f) {
        val a = (strap * 2f).coerceAtMost(1f) * fade
        scale(scaleX = 0.35f + 0.65f * strap, scaleY = 1f, pivot = p(66f, 78f)) {
            drawRoundRect(Eucalyptus.copy(alpha = a), p(56f, 73f), Size(20 * u, 10 * u), CornerRadius(4 * u))
        }
        val s = ((strap - 0.5f) * 2f).coerceIn(0f, 1f)
        drawRoundRect(Forest.copy(alpha = s * fade), p(76f, 71f), Size(7 * u, 14 * u), CornerRadius(2 * u))
    }
}

/** The sideways reach, from the front: the patient behind the table, the mat along its edge to their side. */
private fun DrawScope.frontScene(t: Float) {
    val u = size.width / 300f
    fun p(x: Float, y: Float) = Offset(x * u, y * u)
    val furniture = Forest2.copy(alpha = 0.45f)
    val fade = 1f - ((t - HOLD_END) / 400f).coerceIn(0f, 1f)

    // the patient, upright, behind the table: head, shoulders, trunk
    drawCircle(Forest, 12 * u, p(110f, 36f))
    drawLine(Forest, p(110f, 56f), p(110f, 104f), 20 * u, StrokeCap.Round)
    drawLine(Forest, p(96f, 60f), p(124f, 60f), 12 * u, StrokeCap.Round)
    // the other arm, resting
    drawLine(Forest, p(94f, 62f), p(86f, 96f), 8 * u, StrokeCap.Round)
    drawLine(Forest, p(86f, 96f), p(96f, 104f), 8 * u, StrokeCap.Round)

    // the table, seen from the front
    drawLine(furniture, p(36f, 110f), p(270f, 110f), 7 * u, StrokeCap.Round)
    drawLine(furniture, p(48f, 110f), p(48f, 172f), 5 * u, StrokeCap.Round)
    drawLine(furniture, p(258f, 110f), p(258f, 172f), 5 * u, StrokeCap.Round)

    // 1. the phone, sideways, stands up at the back corner (its back to us) against a book
    val phone = part(t, 0f, EaseInOutCubic::transform)
    drawRoundRect(furniture.copy(alpha = 0.45f * fade), p(46f, 92f), Size(40 * u, 13 * u), CornerRadius(2 * u))
    if (phone > 0f) scale(scaleX = 1f, scaleY = phone, pivot = p(64f, 106f)) {
        drawRoundRect(Forest.copy(alpha = (phone * 3f).coerceAtMost(1f) * fade), p(44f, 80f), Size(42 * u, 26 * u), CornerRadius(3 * u))
    }

    // 2. the mat slides in along the table edge, on the reaching side, white button nearest the hand
    val mat = part(t, STEP)
    if (mat > 0f) translate(left = (1f - mat) * 50 * u) {
        val a = mat * fade
        drawRoundRect(Wash.copy(alpha = a), p(146f, 100f), Size(104 * u, 8 * u), CornerRadius(3 * u))
        drawRoundRect(Eucalyptus.copy(alpha = a), p(146f, 100f), Size(104 * u, 8 * u), CornerRadius(3 * u), style = Stroke(1.5f * u))
        listOf(Panel, ButtonGreen, ButtonBlue, ButtonRed).forEachIndexed { i, c ->
            val at = p(160f + i * 26f, 99f)
            drawCircle(c.copy(alpha = a), 5 * u, at)
            drawCircle(Forest2.copy(alpha = 0.7f * a), 5 * u, at, style = Stroke(1.2f * u))
        }
    }

    // 3. the chest strap across the chest, the sensor in the middle
    val strap = part(t, 2 * STEP)
    if (strap > 0f) {
        val a = (strap * 2f).coerceAtMost(1f) * fade
        scale(scaleX = 0.3f + 0.7f * strap, scaleY = 1f, pivot = p(110f, 78f)) {
            drawRoundRect(Eucalyptus.copy(alpha = a), p(98f, 73f), Size(24 * u, 9 * u), CornerRadius(4 * u))
        }
        val s = ((strap - 0.5f) * 2f).coerceIn(0f, 1f)
        drawRoundRect(Forest.copy(alpha = s * fade), p(105f, 70f), Size(10 * u, 15 * u), CornerRadius(2 * u))
        drawRoundRect(Plaster.copy(alpha = 0.5f * s * fade), p(107f, 72f), Size(6 * u, 4 * u), CornerRadius(1 * u))
    }

    // the reaching arm: resting, then out sideways to the blue button and back
    val k = show(t)
    val shoulder = p(126f, 62f)
    val elbow = lerp(p(134f, 96f), p(166f, 80f), k)
    val hand = lerp(p(124f, 104f), p(212f, 96f), k)
    drawLine(Forest, shoulder, elbow, 8 * u, StrokeCap.Round)
    drawLine(Forest, elbow, hand, 8 * u, StrokeCap.Round)
}
