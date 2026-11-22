package ca.remotion.phone

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
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
  The opening, about a second: it picks up where Android's launch screen leaves off
  (res/drawable/splash_figure.xml, the seated figure at rest, same size and place), and
  the arm reaches out to the target while the back stays upright, which is the whole idea
  of the device. Then the wordmark rises in and the app crossfades in. With animations
  turned off on the phone, it's skipped.
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
    LaunchedEffect(Unit) {
        if (reduced) { onDone(); return@LaunchedEffect }
        delay(60)
        launch {
            reach.animateTo(1f, tween(520, easing = EaseOutCubic))
            lit.animateTo(1f, tween(160))
        }
        delay(380)
        word.animateTo(1f, tween(320, easing = EaseOutCubic))
        delay(300)
        onDone()
    }
    val rise = with(LocalDensity.current) { 10.dp.toPx() }
    Box(Modifier.fillMaxSize().background(Wall).semantics { contentDescription = "Re:Motion" }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(FIGURE)) {
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
                translationY = (1f - word.value) * rise
            },
        )
    }
}
