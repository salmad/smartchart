import { describe, expect, it } from 'vitest'
import { TOOLS, mcpView, openAiView } from '../../src/engine/tools'

describe('registry', () => {
  it('has the v1 tool set, unique names, no prefixes', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['whoami', 'get_guide', 'list_templates', 'get_template', 'list_decks', 'create_deck', 'get_deck', 'update_deck', 'share_deck',
      'suggest_template', 'create_slide', 'read_slide', 'update_slide', 'change_template', 'move_slide', 'delete_slide', 'check_slide', 'check_storyline', 'resolve_comment'])
  })
  it('every input closes additional properties at the top', () => {
    for (const t of TOOLS) expect(t.input.additionalProperties, t.name).toBe(false)
  })
  it('the three views agree (published contract: only additions allowed)', () => {
    expect(TOOLS.map(mcpView)).toMatchSnapshot()
    expect(TOOLS.map((t) => openAiView(t).function.parameters)).toEqual(TOOLS.map((t) => mcpView(t).inputSchema))
  })
})
