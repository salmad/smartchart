/* The tool registry's shared types. Framework-free: the same tools run behind REST, MCP and (later) the in-app agent. */
import type { Slide, Style, Theme } from "../types";
import type { Check } from "../agent/checks";
import type { JevFn } from "../agent/llm";

export type JsonSchema = { type?: string; description?: string; enum?: readonly unknown[]; properties?: Record<string, JsonSchema>;
  required?: string[]; additionalProperties?: boolean | JsonSchema; items?: JsonSchema; oneOf?: JsonSchema[]; minimum?: number; maximum?: number };
export interface DocSlide { id: string; slide: Slide; issues: string[]; warnings: string[]; checks: Check[] }
export interface DeckDoc { id: string; name: string; style: Style; theme: Theme; accent: string | null; slides: DocSlide[] }
export interface Presence { busy?: { by: string; until: number }; editing?: { slideId: string; until: number } }
export type EventWhat = "created" | "updated" | "template" | "moved" | "deleted" | "deck";
export interface DeckEvent { slideId: string | null; what: EventWhat; paths: string[] }
export interface DeckListItem { deckId: string; name: string; style: Style; slides: number; updated: number; shared: boolean }
export interface AccountPort {
  email: string;
  callsLeftToday(): Promise<number>;
  listDecks(limit: number, cursor: number): Promise<{ decks: DeckListItem[]; next?: number }>;
  share(deckId: string, on: boolean): Promise<string | null>;
  newDeckId(): string;
}
export interface ToolContext {
  deck: DeckDoc | null;              // set for scope "deck"
  rev: number;                       // the deck's revision when loaded (0 for scope "create")
  links: { edit: string; share: string | null } | null;
  presence: Presence;
  port: AccountPort;
  jev: JevFn;
  now(): number;
}
export type Scope = "account" | "deck" | "create";
export interface Annotations { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: false }
export interface HandlerOut { result: Record<string, unknown>; deck?: DeckDoc; events?: DeckEvent[]; named?: boolean }
export interface AnyTool { name: string; title: string; group: string; scope: Scope; description: string; input: JsonSchema; annotations: Annotations;
  run(ctx: ToolContext, input: unknown): Promise<HandlerOut> }
export type ErrorCode = "unauthorized" | "not_found" | "bad_input" | "refused" | "conflict" | "busy" | "quota" | "rate" | "upstream";
export class ToolError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly fix?: string) { super(message); }
}
export function tool<I>(def: Omit<AnyTool, "run"> & { run(ctx: ToolContext, input: I): Promise<HandlerOut> }): AnyTool {
  return { ...def, run: (ctx, input) => def.run(ctx, input as I) };
}
export const READ: Annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const WRITE: Annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
export const DESTRUCTIVE: Annotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
export const IDEMPOTENT: Annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
