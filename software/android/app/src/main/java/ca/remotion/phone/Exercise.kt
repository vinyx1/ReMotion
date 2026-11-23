package ca.remotion.phone

import androidx.compose.runtime.staticCompositionLocalOf

/*
  The exercises a patient can choose before a session (AGENTS.md section 1). The id is the
  dashboard's (software/dashboard/export.py EXERCISES): the phone sends it with every batch
  and the server files the session under it, so it lands in the right tab on the dashboard.

  The device itself runs the same session for all three today: the coach's words and the
  setup drawing change, and the trunk is watched the same way. Sideways reach works with the
  current firmware (the mat is only turned). Hand to mouth and forearm rotation on the real
  device still need firmware modes (rep done by the wrist's angle or turn, no target button to
  press; docs/HANDOFF.md); the demo device plays them already.
*/
enum class Exercise(
    val id: String,
    val title: String,
    /** what it is, under the title in the picker */
    val blurb: String,
    /** a rep in the patient's words: "reach", "lift" */
    val one: String,
    val many: String,
) {
    FORWARD("forward-reach", "Reach forward", "To the buttons in front", "reach", "reaches"),
    SIDEWAYS("sideways-reach", "Reach to the right", "Mat along the edge, on your right", "reach", "reaches"),
    MOUTH("hand-to-mouth", "Hand to mouth", "As if to take a drink", "lift", "lifts"),
    ROTATION("forearm-rotation", "Turn your forearm", "Palm down, then palm up", "turn", "turns");

    fun reps(n: Int) = if (n == 1) one else many

    companion object {
        fun of(id: String?) = entries.firstOrNull { it.id == id } ?: FORWARD
    }
}

/** The exercise chosen for this session (or the last one), for the coach's words. */
val LocalExercise = staticCompositionLocalOf { Exercise.FORWARD }
