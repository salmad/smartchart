/* What the person sees while a turn runs: the turn's real steps, told as what is happening to their slide. */
import type { TraceStep } from '@/engine/agent/agent'

const START = 'Reading what you asked'

/** Each step moves the phrase on; steps that say nothing new (the model thinking between tools) keep the last one. */
const PHASE: Record<string, string> = {
  Pre: 'Working out what you need',
  Classify: 'Choosing how to show it',
  create_slide: 'Writing the slide',
  read_slide: 'Reading your slide',
  Resolve: 'Writing the slide',
  edit_slide: 'Measuring it at full size',
  patch_slide: 'Measuring it at full size',
  Shorten: 'Tightening the words to fit',
  Checks: 'Reviewing the design',
  Reply: 'Finishing up',
}

export function phaseOf(trace: readonly TraceStep[] | undefined): string {
  return (trace ?? []).reduce((now, t) => PHASE[t.step] ?? now, START)
}
