/* The tool registry's shared types. Framework-free: the same tools run behind REST, MCP and (later) the in-app agent. */
import type { Slide, Style, Theme } from "../types.js";
import type { ImageKind } from "../slides/images.js";
import type { Check } from "../agent/checks.js";
import type { JevFn } from "../agent/llm.js";
import type { DeckComment } from "../comments.js";
import type { Version } from "../versions.js";
import type { Doc } from "../docs/types.js";
import type { Block } from "../docs/types.js";
import type { DocComment, CommentOp } from "../comments.js";
import type { DocTree } from "../docs/versions.js";
import type { UserLook } from "../look.js";

export type JsonSchema = { type?: string; description?: string; enum?: readonly unknown[]; properties?: Record<string, JsonSchema>;
  required?: string[]; additionalProperties?: boolean | JsonSchema; items?: JsonSchema; oneOf?: JsonSchema[]; minimum?: number; maximum?: number };
export interface DocSlide { id: string; slide: Slide; issues: string[]; warnings: string[]; checks: Check[] }
export interface DeckDoc { id: string; name: string; style: Style; theme: Theme; accent: string | null; slides: DocSlide[]; comments: DeckComment[] }
/** A doc as the tools read and write it: its id, its name (its title as plain text) and the doc. */
export interface DocFile { id: string; name: string; doc: Doc }
export interface Presence { busy?: { by: string; until: number }; editing?: { slideId: string; until: number } }
export type EventWhat = "created" | "updated" | "template" | "moved" | "deleted" | "deck" | "comment";
export interface DeckEvent { slideId: string | null; what: EventWhat; paths: string[] }
export interface PageRefOut { kind: "doc" | "deck"; id: string }
export interface DeckListItem { deckId: string; name: string; style: Style; slides: number; updated: number; shared: boolean; parent: PageRefOut | null }
export interface WorkspaceItem { workspaceId: string; name: string; role: "owner" | "editor" | "viewer" }
export interface AccountPort {
  email: string;
  callsLeftToday(): Promise<number>;
  /** The user's workspaces, most recently used first. */
  workspaces(): Promise<WorkspaceItem[]>;
  /** One workspace's decks: the one named, else the one most recently used. */
  listDecks(limit: number, cursor: number, workspaceId?: string): Promise<{ workspaceId: string; decks: DeckListItem[]; next?: number }>;
  share(deckId: string, on: boolean): Promise<string | null>;
  newDeckId(): string;
  newDocId(): string;
  /** One workspace's docs: the one named, else the one most recently used. */
  listDocs(limit: number, cursor: number, workspaceId?: string): Promise<{ workspaceId: string; docs: { docId: string; name: string; updated: number; parent: PageRefOut | null }[]; next?: number }>;
  /** Moves a page in its workspace's tree: 'ok', 'foreign' (not found or not readable), or the sentence saying why not. */
  movePage(page: { kind: "doc" | "deck"; id: string }, to: { parent: { kind: "doc" | "deck"; id: string } | null; before?: { kind: "doc" | "deck"; id: string }; after?: { kind: "doc" | "deck"; id: string } }): Promise<"ok" | string>;
  /** The deck's versions, newest first, and the slides their trees name. */
  versions(deckId: string): Promise<Version[]>;
  blobs(deckId: string, hashes: string[]): Promise<{ hash: string; slide: Slide }[]>;
  docVersions(docId: string): Promise<{ n: number; rev: number; by: string; label: string | null; at: number; tree: DocTree }[]>;
  docBlobs(docId: string, hashes: string[]): Promise<{ hash: string; block: Block }[]>;
  docComments(docId: string): Promise<DocComment[]>;
  docComment(docId: string, op: CommentOp, by: string, now: number): Promise<DocComment[] | string>;
  /** add_image: fetch or decode, prepare for its kind, store; refusals are ToolErrors that say what to pass instead. */
  addImage(input: { url?: string; data?: string; domain?: string; kind: ImageKind }): Promise<{ src: string; width: number; height: number; kind: ImageKind; from?: string }>;
}
export interface ToolContext {
  deck: DeckDoc | null;              // set for scope "deck"
  rev: number;                       // the deck's revision when loaded (0 for scope "create")
  /** The signed-in user's palette (not stored on decks or docs). */
  userLook: UserLook;
  links: { edit: string; share: string | null } | null;
  presence: Presence;
  /** Set for scope "doc": the doc as loaded, and who is editing it by hand (expires at `until`). */
  file: DocFile | null;
  docPresence: { editing?: { by: string; until: number } };
  port: AccountPort;
  jev: JevFn;
  now(): number;
  /** Who is calling, as the user knows them ("Claude Code"): signs what the agent resolves. */
  client?: string;
}
export type Scope = "account" | "deck" | "create" | "doc" | "createDoc";
export interface Annotations { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: false }
/** `label`: the version's label when the write is not a user request (a restore). `workspaceId`: where a new deck goes
    (scope "create" or "createDoc"; else the workspace most recently used). `parent`: the page a new one goes under, in that page's workspace. `file`: the doc to save (scopes "doc" and "createDoc"); `what`: a version's label when
    the write is not a user request, so it stands alone in Versions. */
export interface HandlerOut { result: Record<string, unknown>; deck?: DeckDoc; file?: DocFile; what?: string; events?: DeckEvent[]; named?: boolean; label?: string; workspaceId?: string; parent?: { kind: "doc" | "deck"; id: string } }
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
