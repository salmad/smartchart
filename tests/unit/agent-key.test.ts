import { expect, it } from 'vitest'
import { connectCommand } from '../../src/app/agent-key'

it('the connect command for Claude Code', () => {
  expect(connectCommand('https://occam.app', 'sc_abc')).toBe('claude mcp add --transport http smartchart https://occam.app/mcp/v1 --header "Authorization: Bearer sc_abc"')
})
