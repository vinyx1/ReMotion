/*
  The serial protocol (docs/PROTOCOL.md), the same rules as software/tools/protocol.py:
  one line from the device becomes one small message object, and a line that can't be
  read (blank, cut off, garbled) becomes null instead of an error.

      "D,15230,REACHING,4.2,85.3,10.0"            -> Sample
      "R,1,BLUE,412,1380,6.8,2,0,BASELINE"        -> Rep
      "S,10,3"                                    -> SessionEnd
      "I,REACHING,BASELINE,10.0,3,15,30,15,1,7,2" -> Status (reply to ?)
      "E,chest IMU (0x68) not found"              -> DeviceError
      "# calibration OK"                          -> Comment

  Change it together with protocol.py and the firmware (AGENTS.md, section 0).
*/
package ca.remotion.phone

import java.util.Locale

sealed interface Message

/** D line: a sensor reading, 100 times per second. */
data class Sample(
    val tMs: Long,
    val state: String,
    val trunkDeg: Float,
    val wristDps: Float,
    val threshold: Float,
) : Message

/** R line: a finished rep. */
data class Rep(
    val rep: Int,
    val target: String,
    val reactMs: Int,
    val reachMs: Int,
    val peakDeg: Float,
    val bursts: Int,
    val compensated: Boolean,
    val phase: String,     // "" in logs from before blocks existed
) : Message

/** S line: the session ended. */
data class SessionEnd(val reps: Int, val compensatedReps: Int) : Message

/** I line: the reply to the ? command. */
data class Status(
    val state: String,
    val phase: String,     // "" before a block has started
    val threshold: Float,
    val plan: List<Int>,   // reps per block: PRACTICE, BASELINE, TRAINING, POST
    val streaming: Boolean,
    val reps: Int,
    val compensatedReps: Int,
) : Message

/** E line: an error reported by the device. */
data class DeviceError(val message: String) : Message

/** # line: a status message. */
data class Comment(val text: String) : Message

object Protocol {
    const val BAUD = 115200

    // Commands to the device
    const val START = "G"         // start a session, like pressing START
    const val STOP = "X"          // end the session now
    const val STATUS = "?"        // ask for one I line
    const val STREAM_ON = "D1"
    const val STREAM_OFF = "D0"

    /** States in which no session is running (START / G would start one). */
    val IDLE_STATES = setOf("IDLE", "CALIB_FAILED")

    fun parse(raw: String): Message? {
        val line = raw.trim()
        if (line.isEmpty()) return null
        if (line.startsWith("#")) return Comment(line.substring(1).trim())

        val f = line.split(",")
        return try {
            when {
                f[0] == "D" && f.size >= 6 -> Sample(
                    tMs = f[1].toLong(), state = f[2], trunkDeg = f[3].toFloat(),
                    wristDps = f[4].toFloat(), threshold = f[5].toFloat(),
                )
                f[0] == "R" && f.size >= 8 -> Rep(
                    rep = f[1].toInt(), target = f[2], reactMs = f[3].toInt(), reachMs = f[4].toInt(),
                    peakDeg = f[5].toFloat(), bursts = f[6].toInt(), compensated = f[7] == "1",
                    phase = if (f.size >= 9) f[8] else "",
                )
                f[0] == "S" && f.size >= 3 -> SessionEnd(f[1].toInt(), f[2].toInt())
                f[0] == "I" && f.size >= 11 -> Status(
                    state = f[1], phase = f[2], threshold = f[3].toFloat(),
                    plan = f.subList(4, 8).map { it.toInt() }, streaming = f[8] == "1",
                    reps = f[9].toInt(), compensatedReps = f[10].toInt(),
                )
                f[0] == "E" && f.size >= 2 -> DeviceError(f.drop(1).joinToString(","))
                else -> null
            }
        } catch (e: NumberFormatException) {
            null
        }
    }

    fun formatStatus(s: Status): String =
        "I,${s.state},${s.phase},${one(s.threshold)},${s.plan.joinToString(",")}," +
            "${if (s.streaming) 1 else 0},${s.reps},${s.compensatedReps}"

    /** One decimal place, with a dot whatever the phone's language. */
    fun one(x: Float): String = String.format(Locale.US, "%.1f", x)
}
