package ca.remotion.phone

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** One finished session, as the patient's own screen remembers it. */
data class PastSession(
    val endedAt: Long,          // epoch ms
    val reaches: Int,           // reaches that count (practice left out, unless that's all there was)
    val upright: Int,           // of those, how many stayed within the limit
    val demo: Boolean,
    val exercise: Exercise = Exercise.FORWARD,
) {
    val day: LocalDate get() = Instant.ofEpochMilli(endedAt).atZone(ZoneId.systemDefault()).toLocalDate()
}

/**
  The sessions done on this phone, newest last, kept in a small JSON file in the app's own
  storage. It's only what the patient's screen needs (the week, last time); the full record
  of every rep goes to the dashboard.
*/
class History(context: Context) {
    private val file = File(context.filesDir, "history.json")

    fun load(): List<PastSession> = try {
        val a = JSONArray(file.readText())
        List(a.length()) { i ->
            val o = a.getJSONObject(i)
            PastSession(o.getLong("endedAt"), o.getInt("reaches"), o.getInt("upright"), o.optBoolean("demo"), Exercise.of(o.optString("exercise")))
        }
    } catch (_: Exception) {
        emptyList()                                       // first run, or an unreadable file
    }

    /** Forget every session (a different patient signed in on this phone). */
    fun clear(): List<PastSession> {
        file.delete()
        return emptyList()
    }

    fun add(session: PastSession): List<PastSession> {
        val all = (load() + session).takeLast(MAX)
        val a = JSONArray()
        all.forEach { s ->
            a.put(JSONObject().put("endedAt", s.endedAt).put("reaches", s.reaches).put("upright", s.upright).put("demo", s.demo).put("exercise", s.exercise.id))
        }
        val tmp = File(file.parentFile, "history.json.tmp")
        tmp.writeText(a.toString())
        tmp.renameTo(file)
        return all
    }

    companion object {
        private const val MAX = 500

        /** The session's reaches that count: practice is a warm-up, unless the session was only practice. */
        fun summarize(reps: List<Rep>, demo: Boolean, exercise: Exercise = Exercise.FORWARD, endedAt: Long = System.currentTimeMillis()): PastSession {
            val scored = reps.filter { it.phase != "PRACTICE" }.ifEmpty { reps }
            return PastSession(endedAt, scored.size, scored.count { !it.compensated }, demo, exercise)
        }

        /** Monday to Sunday of this week, each with whether there was a session that day. */
        fun week(history: List<PastSession>, today: LocalDate = LocalDate.now()): List<Pair<LocalDate, Boolean>> {
            val monday = today.with(DayOfWeek.MONDAY)
            val days = history.map { it.day }.toSet()
            return (0L until 7L).map { monday.plusDays(it).let { d -> d to (d in days) } }
        }
    }
}
