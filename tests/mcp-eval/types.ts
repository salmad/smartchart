// Shapes of the MCP slide eval (docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md).
import type { Slide, Style, TemplateId } from '@/engine/types'

export type Group = 'criteria' | 'figures' | 'positions' | 'actions' | 'stress' | 'near-miss' | 'ask' | 'routing'
export interface Case {
  id: string; group: Group; style: Style; prompt: string
  gold: TemplateId | null; acceptable: TemplateId[]; ask: boolean; files: string[]
  facts: { numbers: string[]; names: string[] }
  questions: { q: string; must: boolean }[]
}
/** One check's outcome; `must` marks a case question that gates the magic rate. */
export interface Check { id: string; ok: boolean; msg: string; must?: boolean }
export interface ToolCall { name: string; input: Record<string, unknown>; result: string; isError: boolean }
export interface Init { apiKeySource: string; model: string; mcpServers: { name: string; status: string }[]; version: string }
export interface Outcome { isError: boolean; numTurns: number; durationMs: number; costUsd: number; denials: string[]; text: string; structured: unknown }
export interface Transcript { init: Init | null; calls: ToolCall[]; finalText: string; outcome: Outcome | null }
export interface Deck { id: string; style: Style; edit: string; slides: { id: string; slide: Slide }[] }
export interface Measured { slideId: string; fit: string[]; issues: string[]; warnings: string[]; png: string }
/** Where the text that misled the agent lives, so the report says what to fix. */
export const SOURCES = ['server instructions', 'tool description', 'template card', 'guide', 'tool result', 'none'] as const
export interface Verdict {
  generic: { id: string; yes: boolean; why: string }[]
  case: { q: string; yes: boolean; why: string }[]
  numbers: { value: string; kind: 'derived' | 'invented'; why: string }[]
  magic: { presentAsIs: boolean; fix: string }
  confusedBy: { mismatch: string; quote: string; source: (typeof SOURCES)[number]; why: string; fix: string }[]
}
export interface Run {
  id: string; caseId: string; n: number; status: 'done' | 'limited' | 'error'; error?: string
  transcript: Transcript | null; deck: Deck | null; measured: Measured[]
  checks: Check[]; unknownFigures: string[]
  verdict?: Verdict; judgeModel?: string
}
export type Results = Record<string, Run>
