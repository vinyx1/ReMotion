/*
  One icon per exercise: a small seated figure doing the movement, on the same 24px
  grid, 1.75px stroke, round caps and joins as the Lucide icons used everywhere
  else, so they read as one set. The figure is always drawn the same way (head,
  trunk, thigh, shin; no chair, which only added lines); only the arm and its goal change:

    forward reach     side view, arm straight out in front to a target
    sideways reach    front view, arm straight out to the side to a target
    hand to mouth     side view, elbow bent, hand up at the mouth
    forearm rotation  forearm level in front, a turning arrow around it

  The target (or the mouth) is the one filled shape. Each drawing is nudged so it
  sits optically centred in its circle. Colour comes from currentColor.
*/
import { EXERCISES } from '../lib/exercises'
import { cn } from '../lib/utils'
import type { ExerciseId } from '../types'

/** The seated figure, side view, facing right: head, trunk, thigh and shin. */
const SEATED = <><circle cx="7" cy="4.75" r="2" /><path d="M7 7.25v7h5v5.5" /></>

const PATHS: Record<ExerciseId, React.ReactNode> = {
  // side view, arm straight forward to the target
  'forward-reach': (
    <g transform="translate(1.25 0)">
      {SEATED}
      <path d="M7 9.5h8.25" />
      <circle cx="18" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
    </g>
  ),
  // front view (so both legs show), arm straight out to the side to the target
  'sideways-reach': (
    <g transform="translate(-1.5 0)">
      <circle cx="10" cy="4.75" r="2" />
      <path d="M10 7.25v7M7.5 14.25h5M7.5 14.25v5.5M12.5 14.25v5.5" />
      <path d="M10 9.5h8.25" />
      <circle cx="21" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
    </g>
  ),
  // side view, elbow out in front and the hand back up at the mouth
  'hand-to-mouth': (
    <g transform="translate(2 0)">
      {SEATED}
      <path d="M7 9.5l6 2-1.75-5" />
      <circle cx="11" cy="5" r="1" fill="currentColor" stroke="none" />
    </g>
  ),
  // side view, forearm level in front, a turning arrow around the hand
  'forearm-rotation': (
    <g transform="translate(1 0)">
      {SEATED}
      <path d="M7 9.5l1.5 2.5h8" />
      <path d="M11.5 8.5a4 4 0 0 1 6 0" />
      <path d="M15.5 7.25l2 1.25.5-2.25" />
    </g>
  ),
}

export function ExerciseIcon({ exercise, className }: { exercise: ExerciseId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden className={className}>
      {PATHS[exercise]}
    </svg>
  )
}

/** The icon in its exercise's colour, on a round tile tinted with it. */
export function ExerciseBadge({ exercise, size, className }: { exercise: ExerciseId; size: number; className?: string }) {
  const color = EXERCISES[exercise].color
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full', className)}
      style={{ width: size, height: size, color, background: `color-mix(in oklab, ${color} 13%, var(--color-plaster))` }}>
      <ExerciseIcon exercise={exercise} className="size-[56%]" />
    </span>
  )
}
