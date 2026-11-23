package ca.remotion.phone

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
  Before anything else, the phone signs in as its patient, with the code from that patient's
  Profile & settings page on the dashboard: scan the QR code (the big button), or type the
  6 letters. The same split as the rest of the app: what to do on the wall, the code to type
  on the plaster.
*/
@Composable
fun SignInScreen(state: SignInState, onScan: () -> Unit, onCode: (String) -> Unit, onSettings: () -> Unit) {
    var code by rememberSaveable { mutableStateOf("") }
    val clean = code.uppercase().filter { it.isLetterOrDigit() }.take(6)
    Row(Modifier.fillMaxSize().background(Plaster)) {
        Column(
            Modifier.weight(2f).fillMaxHeight().background(Wall)
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Start + WindowInsetsSides.Vertical))
                .padding(start = 32.dp, end = 28.dp, top = 24.dp, bottom = 20.dp),
        ) {
            Text("Welcome to Re:Motion", style = LabelStyle.copy(fontSize = 19.sp), color = Forest)
            Spacer(Modifier.heightIn(min = 10.dp))
            Text("Sign in with your code", style = CoachStyle, color = Forest, modifier = Modifier.semantics { heading() })
            Text("Your therapist shows it on your Re:Motion profile. Scan it, or type its 6 letters.",
                style = CoachSubStyle, color = Forest, modifier = Modifier.padding(top = 12.dp))
            Spacer(Modifier.weight(1f))
            PrimaryButton(if (state.busy) "Signing in…" else "Scan the code", onScan)
        }
        Column(
            Modifier.weight(1f).fillMaxHeight()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.End + WindowInsetsSides.Vertical))
                .padding(start = 24.dp, end = 20.dp, top = 12.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onSettings, contentPadding = PaddingValues(horizontal = 10.dp)) {
                    Text("Settings", fontSize = 15.sp, color = Forest2)
                }
            }
            Text("Or type the code", style = LabelStyle, color = Forest2)
            OutlinedTextField(
                value = code, onValueChange = { code = it.take(8) }, singleLine = true, enabled = !state.busy,
                placeholder = { Text("ABC 123", style = codeStyle, color = Forest2.copy(alpha = 0.5f)) },
                textStyle = codeStyle,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { if (clean.length == 6) onCode(clean) }),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedButton(onClick = { onCode(clean) }, enabled = clean.length == 6 && !state.busy,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                Text("Sign in", fontSize = 17.sp, color = Forest, fontWeight = FontWeight.Bold)
            }
            if (state.error != null) {
                Text(state.error, style = BodyStyle.copy(fontSize = 16.sp), color = Forest,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
        }
    }
}

private val codeStyle = TextStyle(fontFamily = AtkinsonMono, fontWeight = FontWeight(600), fontSize = 26.sp,
    letterSpacing = 3.sp, textAlign = TextAlign.Center, color = Forest)
