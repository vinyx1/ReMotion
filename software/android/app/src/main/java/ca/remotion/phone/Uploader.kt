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

  Each session gets its own run (the server's file names, raw_<run>.txt and so on, and the
  time the dashboard shows): a new run starts when the device starts calibrating, so the
  dashboard labels every session with the time it began.
*/
class Uploader(
    baseUrl: String,
    /** this phone's sign-in (Account.kt); the server files the lines under its patient */
    private val token: String,
    private val patient: String,
    private val demo: Boolean,
    /** the exercise chosen now (read when a session starts) */
    private val exercise: () -> String,
    scope: CoroutineScope,
    private val onStatus: (Status) -> Unit,
    /** the server said the sign-in has ended (a demo's hour is up, the patient was deleted) */
    private val onSignedOut: () -> Unit,
) {
    data class Status(val address: String, val sent: Int = 0, val waiting: Int = 0, val error: String? = null)

    private val address = baseUrl.trim().trimEnd('/')
    private val endpoint = URL("$address/api/phone/lines")
    /** The run lines are added to now: named by when it started. */
    private var run = stamp()
    /** Each run's exercise, fixed when the run starts. */
    private val exercises = HashMap<String, String>().apply { put(run, exercise()) }
    /** Lines waiting to be sent, each with the run it belongs to. */
    private val waiting = ArrayDeque<Pair<String, String>>()
    private var status = Status(address)

    private val job = scope.launch(Dispatchers.IO) {
        while (isActive) {
            delay(1000)
            flush()
        }
    }

    /** Queue one line (called for every line the device sends). */
    fun add(line: String) = synchronized(waiting) {
        if (line.startsWith("# calibrating")) {             // a session is starting: give it its own run
            val next = stamp()
            run = if (next > run) next else bump(run)          // never reuse a run's name
            exercises[run] = exercise()
        }
        waiting.addLast(run to line)
        if (waiting.size > MAX_WAITING) waiting.removeFirst()
    }

    /** Stop the once-a-second sending; whatever is still waiting goes out in one last try. */
    fun close(scope: CoroutineScope) {
        job.cancel()
        scope.launch(Dispatchers.IO) { flush() }
    }

    @Volatile private var signedOut = false

    private fun flush() {
        if (signedOut) return
        // one batch is lines of one run, in order
        val batch = synchronized(waiting) {
            val r = waiting.firstOrNull()?.first
            val out = ArrayList<Pair<String, String>>()
            while (out.size < BATCH && waiting.firstOrNull()?.first == r && r != null) out.add(waiting.removeFirst())
            out
        }
        if (batch.isEmpty()) return report(status.copy(waiting = 0))
        try {
            post(batch.first().first, batch.map { it.second })
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

    private fun post(run: String, lines: List<String>) {
        val body = JSONObject()
            .put("patient", patient)
            .put("demo", demo)
            .put("run", run)
            .put("exercise", synchronized(waiting) { exercises[run] } ?: Exercise.FORWARD.id)
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
            c.setRequestProperty("Authorization", "Bearer $token")
            c.outputStream.use { it.write(body) }
            val code = c.responseCode
            if (code == 401) { signedOut = true; job.cancel(); onSignedOut(); return }
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
        val FORMAT = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
        fun stamp(): String = synchronized(FORMAT) { FORMAT.format(Date()) }
        /** The next second after a run's name (two sessions started within one second). */
        fun bump(run: String): String = synchronized(FORMAT) { FORMAT.format(Date(FORMAT.parse(run)!!.time + 1000)) }

        const val BATCH = 5000                // 50 s of samples; one batch is normally ~100 lines
        const val MAX_WAITING = 200_000       // ~30 min of samples while the dashboard is unreachable
    }
}
