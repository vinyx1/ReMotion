package ca.remotion.phone

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/*
  The opening, about two seconds: it picks up where Android's launch screen leaves off
  (res/drawable/splash_figure.xml, the seated figure at rest, same size and place), and
  the arm reaches out to the target while the back stays upright, which is the whole idea
  of the device. The wordmark rises in, then everything lifts a little and a phone outline
  turns a quarter turn beside "Turn your phone sideways": the app only works sideways, and
  it opens from a home screen held upright. With animations off on the phone, the finished
  picture (the phone already sideways) shows for a moment instead, without movement.
*/

/** The size Android draws the launch-screen icon at, so the figure doesn't jump when the app takes over. */
private val FIGURE = 240.dp

@Composable
fun Intro(onDone: () -> Unit) {
    val context = LocalContext.current
    val reduced = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val reach = remember { Animatable(0f) }      // 0 = hand at rest, 1 = at the target
    val lit = remember { Animatable(0f) }        // the target fills when the hand gets there
    val word = remember { Animatable(0f) }
    val lift = remember { Animatable(0f) }       // the figure and name move up to make room for the cue
    val cue = remember { Animatable(0f) }        // "Turn your phone sideways" fades in
    val turn = remember { Animatable(0f) }       // its phone turns from upright (0) to sideways (1)
    LaunchedEffect(Unit) {
        if (reduced) {
            // no movement: the finished picture, the phone already sideways, long enough to read
            reach.snapTo(1f); lit.snapTo(1f); word.snapTo(1f); lift.snapTo(1f); cue.snapTo(1f); turn.snapTo(1f)
            delay(1600)
            return@LaunchedEffect onDone()
        }
        delay(60)
        launch {
            reach.animateTo(1f, tween(520, easing = EaseOutCubic))
            lit.animateTo(1f, tween(160))
        }
        delay(380)
        word.animateTo(1f, tween(320, easing = EaseOutCubic))
        launch { lift.animateTo(1f, tween(380, easing = EaseOutCubic)) }
        delay(120)
        cue.animateTo(1f, tween(260, easing = EaseOutCubic))
        delay(120)
        turn.animateTo(1f, tween(480, easing = FastOutSlowInEasing))
        delay(420)                                         // held, so the turned phone is seen
        onDone()
    }
    val density = LocalDensity.current
    val rise = with(density) { 10.dp.toPx() }
    val up = with(density) { 44.dp.toPx() }
    Box(Modifier.fillMaxSize().background(Wall).semantics { contentDescription = "Re:Motion. Turn your phone sideways." },
        contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(FIGURE).graphicsLayer { translationY = -lift.value * up }) {
            val u = size.minDimension / 108f                    // one unit of the 108-grid
            fun p(x: Float, y: Float) = Offset(x * u, y * u)
            drawCircle(Forest, 6 * u, p(44f, 36f))                                       // head
            drawLine(Forest, p(44f, 45f), p(44f, 70f), 8 * u, StrokeCap.Round)           // trunk, upright throughout
            val t = reach.value
            val hand = p(53f + (68f - 53f) * t, 62f + (52f - 62f) * t)
            drawLine(Forest, p(47f, 51f), hand, 5 * u, StrokeCap.Round)                  // the arm
            drawCircle(Eucalyptus, 5 * u, p(76f, 52f), alpha = lit.value)               // target, lit
            drawCircle(Eucalyptus, 4.5f * u, p(76f, 52f), style = Stroke(3 * u))
            drawLine(Forest, p(30f, 80f), p(84f, 80f), 3 * u, StrokeCap.Round)          // the table
        }
        Text(
            "Re:Motion",
            style = TextStyle(fontFamily = Literata, fontWeight = FontWeight(600), fontSize = 34.sp, letterSpacing = (-0.02).em),
            color = Forest,
            modifier = Modifier.offset(y = 92.dp).graphicsLayer {
                alpha = word.value
                translationY = (1f - word.value) * rise - lift.value * up
            },
        )
        // the app only works sideways: a phone outline turns a quarter turn, with the words
        Row(
            Modifier.offset(y = 118.dp).graphicsLayer { alpha = cue.value },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Canvas(Modifier.size(36.dp).graphicsLayer { rotationZ = -90f * turn.value }) {
                val w = size.minDimension
                val body = Size(w * 0.5f, w * 0.86f)
                val corner = CornerRadius(w * 0.09f)
                drawRoundRect(Forest, Offset((w - body.width) / 2, (w - body.height) / 2), body, corner, style = Stroke(w * 0.07f))
                drawLine(Forest, Offset(w * 0.44f, w * 0.83f), Offset(w * 0.56f, w * 0.83f), w * 0.06f, StrokeCap.Round)
            }
            Text("Turn your phone sideways", style = LabelStyle.copy(fontSize = 19.sp), color = Forest)
        }
    }
}
