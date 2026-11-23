package ca.remotion.phone

import androidx.compose.runtime.staticCompositionLocalOf

/*
  The exercises a patient can choose before a session (AGENTS.md section 1). The id is the
  dashboard's (software/dashboard/export.py EXERCISES): the phone sends it with every batch
  and the server files the session under it, so it lands in the right tab on the dashboard.

  The device itself runs the same session for all three today: the coach's words and the
  setup drawing change, and the trunk is watched the same way. Sideways reach works with the
  current firmware (the mat is only turned). Hand to mouth on the real device still needs the
  firmware's wrist-angle mode (no target button to press); the demo device plays it already.
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
    FORWARD("forward-reach", "Reach forward", "Reach out in front to the buttons", "reach", "reaches"),
    SIDEWAYS("sideways-reach", "Reach to the right", "The mat along the table edge, on your right", "reach", "reaches"),
    MOUTH("hand-to-mouth", "Hand to mouth", "Lift your hand up as if to drink", "lift", "lifts");

    fun reps(n: Int) = if (n == 1) one else many

    companion object {
        fun of(id: String?) = entries.firstOrNull { it.id == id } ?: FORWARD
    }
}

/** The exercise chosen for this session (or the last one), for the coach's words. */
val LocalExercise = staticCompositionLocalOf { Exercise.FORWARD }
