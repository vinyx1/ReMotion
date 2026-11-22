package ca.remotion.phone

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/** The whole app: the patient's screen, or the care team's settings over it. */
@Composable
fun MainScreen(vm: MainViewModel) {
    val s by vm.ui.collectAsStateWithLifecycle()
    val past by vm.past.collectAsStateWithLifecycle()
    val finished by vm.finished.collectAsStateWithLifecycle()
    var settings by rememberSaveable { mutableStateOf(false) }
    var intro by rememberSaveable { mutableStateOf(true) }      // once per launch, not on rotation
    Crossfade(intro, animationSpec = tween(260), label = "intro") { opening ->
        if (opening) Intro(onDone = { intro = false }) else App(s, past, finished, vm, settings) { settings = it }
    }
}

@Composable
private fun App(s: UiState, past: List<PastSession>, finished: PastSession?, vm: MainViewModel, settings: Boolean, setSettings: (Boolean) -> Unit) {
    if (settings) BackHandler { setSettings(false) }
    AnimatedContent(settings, transitionSpec = { fadeThrough() }, label = "settings") { open ->
        Surface(Modifier.fillMaxSize(), color = Plaster) {
            if (open) {
                SettingsScreen(s, vm, onClose = { setSettings(false) })
            } else {
                PatientApp(s, past, finished, PatientActions(
                    onConnect = { vm.connectUsb() },
                    onEnd = { vm.send(Protocol.STOP) },
                    onDone = vm::dismissFinished,
                    onSettings = { setSettings(true) },
                    onAddReach = vm::addDemoRep,
                ))
            }
        }
    }
}

/*
  For the therapist and the team, not the patient: the demo device, how long a session is,
  where the dashboard is, and every line the device sends.
*/
@Composable
private fun SettingsScreen(s: UiState, vm: MainViewModel, onClose: () -> Unit) {
    Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(28.dp)) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Settings for the care team", style = CoachStyle.copy(fontSize = 28.sp, lineHeight = 32.sp), color = Forest,
                    modifier = Modifier.weight(1f).semantics { heading() })
                TextButton(onClick = onClose) { Text("Back", fontSize = 17.sp) }
            }
            Text("Patient: ${MainViewModel.PATIENT_NAME}", style = BodyStyle, color = Forest)

            Section("Device")
            if (s.connected == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PrimaryButton("Connect device", { vm.connectUsb() })
                    OutlinedButton(onClick = vm::startDemo, modifier = Modifier.height(56.dp)) { Text("Use the demo device") }
                }
                Text("The demo device is pretend: start a session from the patient screen, then add reaches one at a time here or there.",
                    style = BodyStyle.copy(fontSize = 15.sp), color = Forest2)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Connected: ${s.connected}", style = BodyStyle, color = Forest, modifier = Modifier.weight(1f))
                    OutlinedButton(onClick = { vm.disconnect() }) { Text("Disconnect") }
                }
                if (s.demo) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(onClick = { vm.send(Protocol.START) }, enabled = !s.sessionRunning) { Text("Start a session") }
                        OutlinedButton(onClick = vm::addDemoRep, enabled = s.state == "WAIT_HOME") { Text("Add a reach") }
                    }
                }
            }

            Section("Session length")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = { vm.setPlan(listOf(3, 15, 30, 15)) }, enabled = s.connected != null && !s.sessionRunning) {
                    Text("Full: 3 · 15 · 30 · 15")
                }
                OutlinedButton(onClick = { vm.setPlan(listOf(0, 0, 5, 0)) }, enabled = s.connected != null && !s.sessionRunning) {
                    Text("Short: 5 reaches")
                }
            }
            Text("Reaches per block: warm-up, on your own, with the buzzer, on your own again. Only between sessions.",
                style = BodyStyle.copy(fontSize = 15.sp), color = Forest2)

            Section("Dashboard")
            OutlinedTextField(
                value = s.dashboard, onValueChange = vm::setDashboard, singleLine = true, enabled = s.connected == null,
                label = { Text("Dashboard address") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            UploadLine(s.upload)
            Text("The laptop's address, e.g. http://192.168.1.20:5173 (start the dashboard with npm run dev -- --host). " +
                "Over a USB cable to the laptop: adb reverse tcp:5173 tcp:5173 and http://localhost:5173. Change it while disconnected.",
                style = BodyStyle.copy(fontSize = 15.sp), color = Forest2)
        }
        LogView(s, vm::setShowSamples, Modifier.weight(1f))
    }
}

@Composable
private fun Section(title: String) {
    Text(title, style = LabelStyle.copy(fontSize = 18.sp), color = Forest, modifier = Modifier.padding(top = 10.dp).semantics { heading() })
}

/** Where the lines are going, and whether they're getting there. */
@Composable
private fun UploadLine(u: Uploader.Status?) {
    val text = when {
        u == null -> "Not sending to a dashboard right now."
        u.error != null -> "Dashboard not reachable at ${u.address} (${u.error}). Keeping ${"%,d".format(u.waiting)} lines to send when it is."
        else -> "Sending to ${u.address} · ${"%,d".format(u.sent)} lines sent"
    }
    Text(text, style = BodyStyle.copy(fontSize = 15.sp, fontFeatureSettings = "tnum"), maxLines = 2, overflow = TextOverflow.Ellipsis,
        color = if (u?.error != null) TerraDeep else Forest)
}

/** Every line from the device, newest at the bottom. Samples (100 a second) are hidden unless asked for. */
@Composable
private fun LogView(s: UiState, onShowSamples: (Boolean) -> Unit, modifier: Modifier) {
    val list = rememberLazyListState()
    LaunchedEffect(s.log.lastOrNull()?.id) {
        if (s.log.isNotEmpty()) list.scrollToItem(s.log.size - 1)
    }
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("From the device", style = LabelStyle, color = Forest, modifier = Modifier.weight(1f))
            Checkbox(checked = s.showSamples, onCheckedChange = onShowSamples)
            Text("Show samples", fontSize = 14.sp, color = Forest)
        }
        HorizontalDivider(color = Wall)
        LazyColumn(state = list, modifier = Modifier.fillMaxWidth().weight(1f).background(Panel, RoundedCornerShape(8.dp)).padding(8.dp)) {
            items(s.log, key = { it.id }) { line -> LogRow(line) }
        }
    }
}

@Composable
private fun LogRow(line: LogLine) {
    // a rep says clean or leaned in words first, so the colour is never the only sign
    val (color, prefix) = when (line.kind) {
        LogLine.Kind.SENT -> Lake to ""
        LogLine.Kind.REP_LEANED -> TerraDeep to "leaned  "
        LogLine.Kind.REP -> Forest to "clean   "
        LogLine.Kind.ERROR -> TerraDeep to ""
        LogLine.Kind.SAMPLE, LogLine.Kind.COMMENT -> Forest2 to ""
        else -> Forest to ""
    }
    Text(prefix + line.text, fontFamily = AtkinsonMono, fontSize = 12.sp, color = color, lineHeight = 16.sp,
        fontWeight = if (line.kind == LogLine.Kind.SENT) FontWeight.SemiBold else FontWeight.Normal)
}
