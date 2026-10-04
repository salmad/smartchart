import { expect, it } from 'vitest'
import { connectCommand } from '../../src/app/agent-key'

it('the connect command for Claude Code', () => {
  expect(connectCommand('https://occam.app', 'sc_abc')).toBe('claude mcp add --transport http smartchart https://occam.app/mcp/v1 --header "Authorization: Bearer sc_abc"')
})

it('one step per client: links and config carry the server and the key', async () => {
  const { CLIENTS, skillCommand } = await import('../../src/app/agent-key')
  const v = (id: string) => CLIENTS.find((c) => c.id === id)?.value('https://occam.app', 'sc_abc') ?? ''
  const want = { url: 'https://occam.app/mcp/v1', headers: { Authorization: 'Bearer sc_abc' } }
  const cursor = new URL(v('cursor'))
  expect(cursor.protocol).toBe('cursor:')
  expect(JSON.parse(atob(cursor.searchParams.get('config') ?? ''))).toEqual(want)
  expect(JSON.parse(decodeURIComponent(v('vscode').replace(/^vscode:mcp\/install\?/, '')))).toEqual({ name: 'occam', type: 'http', ...want })
  expect(JSON.parse(v('claude-desktop')).mcpServers.occam.args).toEqual(['-y', 'mcp-remote', 'https://occam.app/mcp/v1', '--header', 'Authorization: Bearer sc_abc'])
  expect(v('other')).toContain('https://occam.app/mcp/v1')
  expect(skillCommand('https://occam.app')).toBe('mkdir -p ~/.claude/skills/occam && curl -fsSL https://occam.app/agents/occam/SKILL.md -o ~/.claude/skills/occam/SKILL.md')
})
