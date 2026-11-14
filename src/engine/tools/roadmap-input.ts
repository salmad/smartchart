import { ToolError, type LoadedRoadmap, type ToolContext } from './types.js'

export function requireRequest(request: string): string {
  const trimmed = request.trim()
  if (!trimmed) throw new ToolError('bad_input', "request: the user's own words.")
  return trimmed.slice(0, 300)
}

export const loaded = (ctx: ToolContext): LoadedRoadmap => {
  if (!ctx.roadmap) throw new ToolError('bad_input', 'No roadmap.', 'Pass roadmapId.')
  return ctx.roadmap
}