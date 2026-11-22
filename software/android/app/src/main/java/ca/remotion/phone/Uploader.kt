package ca.remotion.phone

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
  Sends every line from the device to the dashboard server (software/web/server/phone.ts)
  over Wi-Fi, in a batch about once a second. The server stores them and turns each
  finished rep into the usual session files, so it appears on the dashboard.

  If the server can't be reached, the lines wait here (up to MAX_WAITING, oldest dropped
  first) and go out once it can, so a short Wi-Fi drop loses nothing.
*/
class Uploader(
    baseUrl: String,
    private val patient: String,
    private val demo: Boolean,
    scope: CoroutineScope,
    private val onStatus: (Status) -> Unit,
) {
    data class Status(val address: String, val sent: Int = 0, val waiting: Int = 0, val error: String? = null)

    /** One recording run, named by when it started (the server's file names: raw_<run>.txt and so on). */
    private val run = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    private val address = baseUrl.trim().trimEnd('/')
    private val endpoint = URL("$address/api/phone/lines")
    private val waiting = ArrayDeque<String>()
    private var status = Status(address)

    private val job = scope.launch(Dispatchers.IO) {
        while (isActive) {
            delay(1000)
            flush()
        }
    }

    /** Queue one line (called for every line the device sends). */
    fun add(line: String) = synchronized(waiting) {
        waiting.addLast(line)
        if (waiting.size > MAX_WAITING) waiting.removeFirst()
    }

    /** Stop the once-a-second sending; whatever is still waiting goes out in one last try. */
    fun close(scope: CoroutineScope) {
        job.cancel()
        scope.launch(Dispatchers.IO) { flush() }
    }

    private fun flush() {
        val batch = synchronized(waiting) {
            List(minOf(BATCH, waiting.size)) { waiting.removeFirst() }
        }
        if (batch.isEmpty()) return report(status.copy(waiting = 0))
        try {
            post(batch)
            val left = synchronized(waiting) { waiting.size }
            report(status.copy(sent = status.sent + batch.size, waiting = left, error = null))
        } catch (e: Exception) {
            val left = synchronized(waiting) {
                waiting.addAll(0, batch)                           // back to the front, in order
                while (waiting.size > MAX_WAITING) waiting.removeFirst()
                waiting.size
            }
            report(status.copy(waiting = left, error = e.message ?: e.javaClass.simpleName))
        }
    }

    private fun post(lines: List<String>) {
        val body = JSONObject()
            .put("patient", patient)
            .put("demo", demo)
            .put("run", run)
            .put("lines", JSONArray(lines))
            .toString()
            .toByteArray(Charsets.UTF_8)
        val c = endpoint.openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"
            c.connectTimeout = 3000
            c.readTimeout = 5000
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(body) }
            val code = c.responseCode
            if (code != 200) throw IllegalStateException("the dashboard answered $code")
        } finally {
            c.disconnect()
        }
    }

    private fun report(s: Status) {
        if (s == status) return
        status = s
        onStatus(s)
    }

    private companion object {
        const val BATCH = 5000                // 50 s of samples; one batch is normally ~100 lines
        const val MAX_WAITING = 200_000       // ~30 min of samples while the dashboard is unreachable
    }
}
