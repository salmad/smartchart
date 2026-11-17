/* The gallery's two flow slides (starters.json): a table with a flow on its right, and a heat grid with a flow of
   grids on its left. Shared by the unit and browser tests, so they test what the gallery shows. */
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }

const pick = (id: string) => {
  const s = starters.slides.find((x) => x.id === id)
  if (!s) throw new Error(`starter ${id} missing`)
  return s.consulting as unknown as { template: 'table'; flow: { tiers: { boxes: object[] }[] }; table: { columns: object[]; rows: { cells: unknown[]; style?: string }[] }; [k: string]: unknown }
}
export const TABLE_FLOW = pick('table-flow')
export const HEAT_GRID = pick('heat-grid')
