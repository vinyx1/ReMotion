package ca.remotion.phone

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith

/*
  The app's motion, in Material's patterns, kept short: the patient is waiting for the next
  instruction, not watching the app. Nothing slides: text that moves is harder to read from
  across the table. Compose follows the phone's animation setting (Remove animations, or the
  animator duration scale), so all of these become instant cuts when animations are off.

    fadeThrough     a different screen (home, session, done, settings): out in 90 ms, in over
                    210 ms with a slight settle from 96%. Material's fade-through.
    swap            the same place saying something new (the coach's instruction, a count,
                    the last reach): out in 90 ms, in over 180 ms. No movement.
    STATE_MS        a colour change that is the state itself (the warm wall, a lit button).
*/

const val STATE_MS = 150

fun <S> AnimatedContentTransitionScope<S>.fadeThrough(): ContentTransform =
    (fadeIn(tween(210, delayMillis = 90, easing = LinearOutSlowInEasing)) +
        scaleIn(tween(210, delayMillis = 90, easing = LinearOutSlowInEasing), initialScale = 0.96f))
        .togetherWith(fadeOut(tween(90, easing = FastOutLinearInEasing)))

fun <S> AnimatedContentTransitionScope<S>.swap(): ContentTransform =
    fadeIn(tween(180, delayMillis = 60, easing = LinearOutSlowInEasing))
        .togetherWith(fadeOut(tween(90, easing = FastOutLinearInEasing)))
