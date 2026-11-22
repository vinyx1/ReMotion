package ca.remotion.phone

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

private val Tabular = TextStyle(fontFeatureSettings = "tnum")

@Composable
fun MainScreen(vm: MainViewModel) {
    val s by vm.ui.collectAsStateWithLifecycle()
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.safeDrawingPadding().padding(horizontal = 16.dp).fillMaxSize()) {
            Header(s.connected, onDisconnect = { vm.disconnect() })
            if (s.connected == null) {
                ConnectPanel(s.message, onConnect = vm::connectUsb, onDemo = vm::startDemo)
            } else {
                if (s.oldFirmware) OldFirmwareNote()
                Readout(s)
                Controls(s, vm::send)
                LogView(s, vm::setShowSamples, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun Header(connected: String?, onDisconnect: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("Re:Motion", fontSize = 24.sp, fontWeight = FontWeight.Medium, fontFamily = FontFamily.Serif)
            Text(connected?.let { "Connected · $it" } ?: "Not connected", fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (connected != null) TextButton(onClick = onDisconnect) { Text("Disconnect") }
    }
}

@Composable
private fun ConnectPanel(message: String?, onConnect: () -> Unit, onDemo: () -> Unit) {
    Column(Modifier.padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Plug the ReMotion device into this phone's USB-C port, then connect.", fontSize = 17.sp)
        if (message != null) Text(message, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Button(onClick = onConnect, modifier = Modifier.fillMaxWidth()) { Text("Connect device") }
        OutlinedButton(onClick = onDemo, modifier = Modifier.fillMaxWidth()) { Text("Demo mode") }
        Text("Demo mode plays a recorded session as if the device were connected.", fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun OldFirmwareNote() {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Text("The device's firmware is older than this app, so Start, End and Status don't work yet. " +
            "Upload the latest reach_tracker firmware from a laptop. The START button on the mat still works.",
            fontSize = 14.sp, modifier = Modifier.padding(12.dp))
    }
}

/** What the device is doing: state, block, trunk lean against the limit, reps. */
@Composable
private fun Readout(s: UiState) {
    val lean = s.latest
    val past = lean != null && lean.trunkDeg > lean.threshold
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Figure("State", s.state.ifEmpty { "—" }, Modifier.weight(1.3f))
            Figure("Block", s.phase.ifEmpty { "—" }, Modifier.weight(1.1f))
            Figure(
                "Trunk lean",
                lean?.let { "${Protocol.one(it.trunkDeg)}°" } ?: "—",
                Modifier.weight(1f),
                // never colour alone: the words say it too
                note = lean?.let { if (past) "past ${Protocol.one(it.threshold)}° limit" else "limit ${Protocol.one(it.threshold)}°" },
                alert = past,
            )
            Figure("Reps", s.reps.toString(), Modifier.weight(0.8f), note = "${s.leaned} leaned")
        }
    }
}

@Composable
private fun Figure(label: String, value: String, modifier: Modifier, note: String? = null, alert: Boolean = false) {
    Column(modifier) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, style = Tabular, maxLines = 1,
            color = if (alert) Terra else MaterialTheme.colorScheme.onSurface)
        if (note != null) Text(note, fontSize = 12.sp, style = Tabular, maxLines = 1,
            color = if (alert) TerraDeep else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Controls(s: UiState, send: (String) -> Unit) {
    Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { send(Protocol.START) }, enabled = !s.sessionRunning, modifier = Modifier.weight(1f)) {
                Text("Start session")
            }
            OutlinedButton(onClick = { send(Protocol.STOP) }, enabled = s.sessionRunning, modifier = Modifier.weight(1f)) {
                Text("End session")
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = s.streaming, onCheckedChange = { send(if (it) Protocol.STREAM_ON else Protocol.STREAM_OFF) })
            Text("Live samples", fontSize = 15.sp, modifier = Modifier.padding(start = 10.dp).weight(1f))
            TextButton(onClick = { send(Protocol.STATUS) }) { Text("Ask status") }
        }
    }
}

/** Every line from the device, newest at the bottom. Samples (100 a second) are hidden unless asked for. */
@Composable
private fun LogView(s: UiState, onShowSamples: (Boolean) -> Unit, modifier: Modifier) {
    val list = rememberLazyListState()
    LaunchedEffect(s.log.lastOrNull()?.id) {
        if (s.log.isNotEmpty()) list.scrollToItem(s.log.size - 1)
    }
    Column(modifier) {
        HorizontalDivider()
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("From the device", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Checkbox(checked = s.showSamples, onCheckedChange = onShowSamples)
            Text("Show samples", fontSize = 14.sp)
        }
        LazyColumn(state = list, modifier = Modifier.fillMaxWidth().weight(1f).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(8.dp)) {
            items(s.log, key = { it.id }) { line -> LogRow(line) }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun LogRow(line: LogLine) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val (color, suffix) = when (line.kind) {
        LogLine.Kind.SENT -> Lake to ""
        LogLine.Kind.REP_LEANED -> TerraDeep to "   leaned"
        LogLine.Kind.REP -> MaterialTheme.colorScheme.onSurface to "   clean"
        LogLine.Kind.ERROR -> TerraDeep to ""
        LogLine.Kind.SAMPLE, LogLine.Kind.COMMENT -> muted to ""
        else -> MaterialTheme.colorScheme.onSurface to ""
    }
    Text(line.text + suffix, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = color, lineHeight = 16.sp,
        fontWeight = if (line.kind == LogLine.Kind.SENT) FontWeight.SemiBold else FontWeight.Normal)
}
