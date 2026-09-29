/* What the person sees while a turn runs: the turn's real steps, told as what is happening to their slide.
   A step can take a while, so each has a few lines that take turns; the first is the step's name. */
import type { TraceStep } from '@/engine/agent/agent'

const START = ['Reading what you asked', 'Finding the point of the slide']

// The slide is checked while it is written, so the reviews take turns with it.
const REVIEWS = ['Logic review', 'Semantic check', 'Spacing and design review']
const WRITING = ['Writing the slide', ...REVIEWS]

/** Each step moves the lines on; steps that say nothing new (the model thinking between tools) keep the last ones. */
const PHASE: Record<string, string[]> = {
  Pre: ['Working out what you need', 'Finding the point of the slide'],
  Classify: ['Choosing how to show it', 'Picking the evidence that proves it'],
  create_slide: WRITING,
  read_slide: ['Reading your slide'],
  Resolve: WRITING,
  edit_slide: ['Measuring it at full size', 'Spacing and design review'],
  patch_slide: ['Measuring it at full size', 'Spacing and design review'],
  Shorten: ['Tightening the words to fit'],
  Checks: REVIEWS,
  Reply: ['Finishing up'],
}

/** The lines for where the turn is now. */
export function phaseLinesOf(trace: readonly TraceStep[] | undefined): string[] {
  return (trace ?? []).reduce((now, t) => PHASE[t.step] ?? now, START)
}

