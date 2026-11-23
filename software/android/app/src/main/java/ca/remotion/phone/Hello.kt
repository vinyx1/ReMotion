package ca.remotion.phone

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/*
  Just after the phone signs in: "Hello, Margaret" on the wall, about a second and a half,
  then the patient's screen eases in (MainScreen's fade-through). It says the code worked and
  whose phone this now is, in one line. Only after a sign-in, never when the app opens.
  The greeting rises 14 dp and fades in over 420 ms; "You're signed in" follows 140 ms later.
  With animations off it simply shows, still, for the same time.
*/
@Composable
fun Hello(firstName: String, onDone: () -> Unit) {
    val context = LocalContext.current
    val reduced = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val name = remember { Animatable(if (reduced) 1f else 0f) }
    val sub = remember { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduced) {
            launch { name.animateTo(1f, tween(420, easing = EaseOutCubic)) }
            delay(140)
            launch { sub.animateTo(1f, tween(360, easing = EaseOutCubic)) }
        }
        delay(1500)
        onDone()
    }
    val rise = with(LocalDensity.current) { 14.dp.toPx() }
    Column(
        Modifier.fillMaxSize().background(Wall).semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
    ) {
        Text(
            if (firstName.isBlank()) "Hello" else "Hello, $firstName",
            style = CoachStyle.copy(fontSize = 56.sp, lineHeight = 62.sp), color = Forest,
            modifier = Modifier.padding(horizontal = 32.dp).graphicsLayer {
                alpha = name.value; translationY = (1f - name.value) * rise
            },
        )
        Text(
            "You’re signed in", style = CoachSubStyle, color = Forest2,
            modifier = Modifier.padding(top = 12.dp).graphicsLayer {
                alpha = sub.value; translationY = (1f - sub.value) * rise * 0.6f
            },
        )
    }
}
