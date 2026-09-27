/* The site's "taste, quantified" sheet. Every line is a rule the engine enforces on every slide;
   tests/unit/taste.test.ts ties each one to its check id and the count to the engine's checks. */

/** Rule checks R1–R14 and judgment checks J1–J8 (src/engine/agent/checks.ts). */
export const CHECK_COUNT = 22

export interface TasteRule { value: string; rule: string; ids: string[] }

export const TASTE: TasteRule[] = [
  { value: '2 lines', rule: 'The longest a title may run. Measured, not estimated.', ids: ['R1'] },
  { value: '1', rule: 'Focus element per slide, and the title names it.', ids: ['R4', 'J4'] },
  { value: '100%', rule: 'Of the figures you give appear on the slide.', ids: ['R11'] },
  { value: '0 px', rule: 'Difference in height between parallel cards.', ids: ['L6'] },
  { value: '2.5×', rule: 'The most one parallel item may outweigh another.', ids: ['R7'] },
  { value: '3', rule: 'Significant figures at most. No false precision.', ids: ['R13'] },
  { value: '20–40%', rule: 'Of a table’s width goes to its label column.', ids: ['L1'] },
  { value: 'Left to right', rule: 'Time always runs oldest to newest.', ids: ['R14'] },
]
