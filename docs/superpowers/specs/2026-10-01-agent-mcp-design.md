# SmartChart for agents: MCP (primary) and REST (secondary)

Status: design, 2026-10-01. Reviewed twice by Fable: for one-way doors, then for gaps, MCP practice, modularity, MECE and progressive disclosure. Both reviews are folded in.

## 1. Goal

An agent such as Claude Code, or OpenClaw driven from Telegram, connects to SmartChart and works on its user's decks. It has two ways in:

- **Fine-grained tools:** list and open decks, pick a template, write a slide, edit one component, run the checks, share the deck.
- **Delegation:** `ask` sends the request to SmartChart's own agent and returns its reply.

The in-app agent and outside agents use **one set of tools**, with the same names and the same code. The post-edit code always runs on our side: autofix → validate → resolve `auto` (Jev) → fit estimate → rule checks. No writer can skip it.

**How it is used:**
1. Talk to Claude Code (connected over MCP) with the deck open in a browser beside it.
2. Ask what decks you have and pick one (`list_decks` → `get_deck`), or start a new one (`create_deck`).
3. Claude gives you the deck's editor link (`/d/:id`, signed in). You get the share link only if you want others to watch.
4. Every change shows up in the open page within seconds.

There is no rendering on the server: the browser is the view.

**Decided:**
- MCP first, REST second, both generated from one registry.
- API keys now, OAuth later. A key acts only for its own user.
- No browser on the server. The fit check counts characters, and the app re-measures when a deck opens.
- `ask` shares the deck's chat with the app.
- `v1` lives in the URL paths, not in tool names. Tools are added, never renamed.

## 2. Architecture

```
   in-app agent (GLM)        MCP client (Claude Code, OpenClaw)        REST client (scripts, skills)
          │                              │                                        │
  OpenAI function view           POST /mcp/v1 (JSON-RPC,                   POST /api/v1/<tool>
          │                      stateless, JSON responses)                        │
          └──────────────────────┬───────┴────────────────────────────────────────┘
                                 ▼
                 Tool registry (src/engine/tools/, framework-free)
     entry: name · title · description · input schema · output schema · annotations · handler
                                 ▼
                Deck service (api/_lib/deck-service.ts, server only)
     auth → load deck (Neon) → handler(ctx, input) → save with rev (retry once) → event → result
                                 ▼
          Engine: schema, write.ts, checks, story, pre, resolve, patch, edit
```

### 2.1 Registry

`src/engine/tools/` has one file per group (section 4) and `index.ts`, which exports `TOOLS`. An entry is:

```ts
interface ToolEntry<I, O> {
  name: string; title: string; group: Group
  description: string                 // written for a model: what, when, what comes back (the output shape too)
  input: JSONSchema                   // outputSchema comes later, as an addition
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: false }
  handler(ctx: ToolContext, input: I): Promise<{ result: O; deck?: DeckDoc; event?: DeckEvent }>
}
interface ToolContext { deck?: DeckDoc; user: { id: string }; client: string; jev: JevFn; step: AgentStepFn; measure: EstimateFn; now(): number }
```

- **Handlers are pure.** They take the deck, return a new deck or none, and never touch HTTP, Neon or React. Because of that, the in-app agent can run the same handlers in the browser (M4), and unit tests need no database.
- **Three views of one entry:** the OpenAI-function view for GLM, MCP `tools/list`, and the REST body schema. A snapshot test covers all three, so they cannot disagree.

### 2.2 Deck service

`api/_lib/deck-service.ts` wraps every call:
1. Authenticate.
2. Load the deck.
3. Run the handler.
4. If the handler returned a deck, save it with `baseRev`. On a conflict, reload and run the handler again once.
5. Record the event (section 6) and return the result.

The service owns the database (`api/_lib/db.ts`).

### 2.3 Model calls on the server

- `api/_lib/models.ts` provides a server-side `JevFn` (OpenRouter) and `AgentStepFn` (Z.ai GLM). They call the providers directly, because `llm.ts` today posts to relative `/api/*` URLs that only work from the browser.
- Each call is counted with `db.countCall(user)`. A read-only `db.callsToday(user)` serves `whoami`.

### 2.4 Hosts

**MCP** (`api/mcp/v1.ts`):
- Streamable HTTP, **stateless**: one POST endpoint, no `Mcp-Session-Id`, JSON responses (no SSE). GET returns 405.
- It validates `Origin`, honours `MCP-Protocol-Version`, and sets `maxDuration: 300` (for `ask`).
- `serverInfo.version` carries the contract date.
- Built with the official TypeScript SDK in stateless mode.

**REST** (`api/v1/[tool].ts`): `POST /api/v1/<tool>` with the input as the JSON body. It returns the same result object.

### 2.5 Measuring on the server

- `EstimateFn` counts characters using the `validate()` limits (maxChars, item counts, row budgets). Write results carry `fit: "estimated"`.
- The app re-measures every slide in a real browser when a deck opens (`recheckRules`, `App.tsx:74`), so an overflow shows there as an amber issue.
- Later, the fit-spike predictor (`docs/research/2026-09-27-fit-spike`, 100% agreement with Chrome on text line counts) replaces the estimate for text, with no contract change.

### 2.6 Live view (editor and share page)

- **A cheap revision check:** `GET /api/decks?id=…&rev=1` and `GET /api/share?s=…&rev=1` return only `{ rev, presence }`, with `Cache-Control: no-store`.
- **Both pages poll it** every 3 s while the tab is visible, and on focus. When `rev` changes they reload and move to the slide that changed.
- **The editor** merges by slide id (section 8) and never reloads over a hand edit in progress.
- **Opening at one slide:** both links accept `?slide=<slideId>`. Ids, not positions.
- **The share data:** `publicDeck()` gains `rev` and `slides[].id`.

## 3. Context: progressive disclosure

The agent gets context in four layers, each fetched only when it's needed, with a token budget per layer. A test enforces the budgets. Everything is generated from the same source as the in-app prompt: `agent-prompt.ts` is split into named sections (hard rules, start plain, when to ask, writing JSON, style). The in-app prompt is all of them plus its own workflow and reply rules. Outside agents get the shared sections.

| Layer | When | Budget | Content |
|---|---|---|---|
| 1. MCP `instructions` | Always in context | ≤ 400 tokens | See below. |
| 2. `get_guide(style)` | Once per session and style, before the first write | ≤ 1.5k tokens | Hard rules (every figure exactly as given; no invented data; illustrative figures marked in the footnote; no made-up source; change only what was asked). Start plain. When to stop and ask (one sentence, then 2–4 numbered options, asked of your own user). Writing slide JSON (maxChars counts visible characters; plain numbers; markup syntax; `"auto"` choices; paths and patches). The style block (`STYLES[style]`). |
| 3a. `list_templates(style)` | When choosing a template | ≤ 400 tokens | Offered templates with summary and "use when", plus the picking guide (`PICKING_GUIDE`, chart vs table). |
| 3b. `get_template(template, style)` | Before the first write of that template | ≤ 3k tokens | The card (fields with type, required, maxChars, item min/max, description; rules incl. `CHART_GUIDE`; markup) and one worked example from the starters. The chart card is 10.4k characters today and needs trimming to fit. |
| 4. Results | Every call | Concise by default | Write results name the path, the limit and the fix. `get_deck` is the storyline. `read_slide` returns the JSON and what can be added, removed or moved. Empty arrays are left out. |

**Instructions (layer 1) say:**
- **What it is:** SmartChart makes consulting and pitch slides. You write slide content as JSON; code owns layout, colours and sizes.
- **Two ways in:** `ask` passes the user's words to SmartChart's own agent, which is best when you only relay. The tools let you write slides yourself.
- **Start:** `list_decks`. If the list is empty, `create_deck`. Give the user the editor link from `get_deck` so they can watch.
- **Before writing:** `get_guide` once per style. `get_template` once per template; cards don't change within a session.
- **Loop:** `suggest_template` or your own choice from `list_templates` → `create_slide` → fix every `issue` → `check_slide` when the slide is done → `check_storyline` when the deck is.
- **Rules:** address slides by `slideId`, never by position. Write `"auto"` where the card allows it. Never set style, layout, colours, page numbers or the footer. If the user's request is unclear, ask them before writing. Change a slide's template only when the user asked for it.

**Not passed outside:** the persona, the reply-writing rules (talking to the user is the calling agent's job), the "Working slides" block (replaced by `read_slide` and the stored slide in every write result), the selection (outside agents pass `slideId` and `path`), and the `reply` parameter.

**Resources (secondary):** the same guide and cards are also exposed as MCP resources (`smartchart://guide/{style}`, `smartchart://template/{style}/{template}`), generated from the same registry entries. The tools remain the primary path, because clients use tools more reliably.

## 4. Tools (v1)

Seven groups, each with one job:

- **Reads** never change anything.
- **Writes** run the write path and return the write result.
- **Checks** report, never change anything, and cost one Jev call.

`suggest_template` and `ask` also cost model calls. Every input schema sets `additionalProperties: false`, except `set` (a path map) and `slide` (checked by `validate()`). `style` and `template` are enums; `template` takes `OFFERED` only. Tool names carry no prefix, because MCP clients already add the server's name (`mcp__smartchart__create_slide`).

Annotations: **R** = readOnly, **D** = destructive, **I** = idempotent. `openWorldHint` is false for every tool.

### 4.1 Account
| Tool | Ann. | In | Out |
|---|---|---|---|
| `whoami` | R | — | `{ email, callsLeftToday, contract: "2026-10-01" }` |

### 4.2 Guide (knowledge; no deck)
| Tool | Ann. | In | Out |
|---|---|---|---|
| `get_guide` | R | `style` | layer 2 (section 3) |
| `list_templates` | R | `style` | `{ templates: [{ template, summary, use }], guide }` |
| `get_template` | R | `template`, `style` | `{ card, example }` |

### 4.3 Decks (deck-level state)
| Tool | Ann. | In | Out |
|---|---|---|---|
| `list_decks` | R | `limit?` (default 25), `cursor?` | `{ decks: [{ deckId, name, style, slides, updated, shared }], next? }`, newest first |
| `create_deck` | — | `style`, `name?`, `theme?`, `accent?` | deck (as `get_deck`). The server mints the id. |
| `get_deck` | R | `deckId` | `{ deckId, name, style, theme, accent, rev, links: { edit, share? }, presence?, slides: [{ slideId, n, template, title, issues }] }`. The slide list is the storyline. |
| `update_deck` | I | `deckId`, `name?`, `theme?`, `accent?`, `style?` | deck. `style` only while the deck has no slides. `accent` is a hex colour checked by the colour rules. |
| `share_deck` | I | `deckId`, `on` | `{ share: url \| null }` |

**Deck name:** a name given through `create_deck` or `update_deck` is kept (`named: true`). The app derives the name from the cover only while the deck has no given name. Today `remote.ts` overwrites the name on every save; M1 fixes that.

### 4.4 Template choice (decision help; Jev)
| Tool | Ann. | In | Out |
|---|---|---|---|
| `suggest_template` | R | `deckId`, `about` (the content, in the user's words), `after?` | `{ template, probabilities, decided, after }` (`pre.ts`, split out of today's `create_slide`) |

### 4.5 Slides (content and structure; write path)
| Tool | Ann. | In | Out |
|---|---|---|---|
| `create_slide` | — | `deckId`, `slide` (full JSON), `after?` (`slideId` \| `"start"` \| `"end"`, default `"end"`), `request?`, `slideId?` (only to restore a deleted slide; must be unused) | write result |
| `read_slide` | R | `deckId`, `slideId`, `path?` | `{ slideId, template, slide \| value, lists: [{ path, min, max, length }] }` (`listOps`). Content only. |
| `update_slide` | D | `deckId`, `slideId`, `set: { path: value }`, `request?` | write result. A value replaces, `null` removes, the next index appends, a whole list reorders. All or nothing. |
| `change_template` | D | `deckId`, `slideId`, `slide` (full JSON in the new template), `request?` | write result (the id is kept) |
| `move_slide` | I | `deckId`, `slideId`, `after` (`slideId` \| `"start"` \| `"end"`) | `{ slides }` (the storyline) |
| `delete_slide` | D | `deckId`, `slideId` | `{ deleted: { slideId, slide } }`. To undo, call `create_slide` with both. |

**Write result:**

```
{ applied, slideId, n, slide, issues?, warnings?, checks?, autofixes?, resolved?, changed?, elsewhere?, fit: "estimated", rev, notice? }
```

- `issues` must be fixed.
- `warnings` are the validate and measure advice. Act on them only with a small edit.
- `checks` are the rule checks that failed (ruleChecks, kept separate from warnings).
- `resolved` lists the `auto` values code picked.
- `changed` (update only) lists the paths that changed. `elsewhere` lists problems on other parts of the slide.
- `notice` is, for example, "the user is editing s_a1b2 right now" (section 8).
- Empty fields are left out.
- When shapes are wrong, nothing is written: the call returns `isError: true` with each error's path and fix.

`request` is the user's own words. Jev uses it for `auto` picks. The guard from the app applies: chart marks stay `auto` unless `request` names one.

### 4.6 Checks (advisory; one Jev call each)
| Tool | Ann. | In | Out |
|---|---|---|---|
| `check_slide` | R | `deckId`, `slideId` | `{ checks: [{ id, ok, msg }] }`: rule checks plus judgment checks |
| `check_storyline` | R | `deckId` | `{ checks: [{ id, ok, msg, slideId?, fix? }] }`: D1–D5, cached by `storyKey`. A `fix` of kind `ask` is an instruction for the calling agent. |

### 4.7 Delegation
| Tool | Ann. | In | Out |
|---|---|---|---|
| `ask` | — | `text`, `deckId?` (omit for a new deck), `style?` (new deck), `slideId?`, `path?`, `files?: [{ name, text }]` | `{ status: "done" \| "question", reply, options?, slides: [{ slideId, n, title, changed }], rev }` |

- `ask` runs `runTurn` on the server with the deck's shared chat, the estimate `measure`, and the slide ids changed outside since the last turn as `edited`.
- A turn is capped at 10 tool calls (`MAX_TOOL_CALLS`), which keeps it within the function's 300 s.
- Its turns appear in the app's chat marked "via <client>".
- With `status: "question"`, the caller relays the options to its user and answers with another `ask`.

### 4.8 Results and errors (all tools)

- **Results:** every result returns `structuredContent` (its shape is described in the tool's description; a formal `outputSchema` is a later addition), plus one text line for clients that read text, e.g. "Applied s_a1b2 at 3 · 2 issues: title over 90 characters; …".
- **Errors** have one shape: `{ error: { code, message, fix? } }`.
  - Tool-level errors (`not_found`, `bad_input` with the path, `refused`, `conflict`, `busy`, `quota`) come back as tool results with `isError: true`, so the model reads them and retries.
  - JSON-RPC errors are reserved for an unknown tool or arguments that fail the schema.
  - `unauthorized` is HTTP 401.
  - Messages are sentences that name the valid ids, paths or values.

**Not in v1:**
- `delete_deck`: permanent, and should be done in the app.
- `duplicate_slide`: read, then create.
- Versions or undo beyond restoring a deleted slide.
- Uploading binary files: the caller extracts the text.
- `get_selection`.
- Rendering (PNG or HTML). Each can be added later as a new tool without changing the others.

## 5. The public data contract

- **Slides are the slide JSON** (`src/engine/types.ts`), addressed by paths (`chart.series[1].values[3]`, `cards[2].title`). There's no second schema. The cards describe it at runtime.
- **Decks are a public shape** (`DeckDoc`), built at the boundary by extending `publicDeck()`. The app's `SavedDeck` layout (`items`, `status`, `current`, the chat) is never exposed.
- **Ids:** deck ids (minted on the server) and slide ids (`s_` + 4 characters, unique within a deck) are permanent and opaque. Every slide call carries `deckId`.
- **Versioning:** the contract date is in `serverInfo.version` and `whoami`. Input goes through `upgrade()`. Fields are added, never renamed. A breaking change means `/mcp/v2` and `/api/v2`.
- **Clean-up before freezing (M1):**
  1. `chart.stacked: boolean | "100" | "auto"` becomes `chart.stacking: "none" | "stacked" | "percent" | "auto"`, and `upgrade()` maps the old field.
  2. `focus: "auto"` resolves into per-item flags and disappears on read-back. The card says so.
  3. Table cells (`string | { value, note }`) stay as they are, documented in the card.
  4. Writes refuse templates not in `OFFERED`. Today `validate()` accepts the archived `number`.

## 6. Shared chat and outside edits

- **`ask`** appends to the deck's `chat` (history and messages), marked with the client's name. Only `ask` and the app write `chat`.
- **Direct writes** add a row to `deck_events` (`deck_id`, `rev`, `by`, `slide_id`, `paths`, `at`).
  - When `rev` changes, the app reads the events since its last revision and passes those slide ids as `edited`. This is the same path hand edits use in `stateBlock`, so the in-app agent hears about them.
  - The chat shows one quiet line per event ("Claude Code updated slide 3").
  - On a 409 the app keeps its own chat, so nothing is lost.

## 7. Auth and onboarding

- **API keys:** each user has one key, created, copied once and replaced from the account menu. It's stored hashed (`api_keys`: `hash`, `user_id`, `prefix`, `created`, `last_used`).
- **The account menu also shows the connect command:**
  `claude mcp add --transport http smartchart https://<host>/mcp/v1 --header "Authorization: Bearer sc_…"`
- `userFrom` accepts `Authorization: Bearer sc_…` as well as cookies. Every query is filtered by user id, so a key reaches only its own user's decks. Another user's deck is reachable only through a share link, which is read-only and separate from keys.
- **Later:** OAuth 2.1 for claude.ai connectors. A 401 with `WWW-Authenticate: Bearer resource_metadata=…` and `/.well-known/oauth-protected-resource`. Check whether Neon Auth's Better Auth includes the MCP/OIDC provider plugin.

## 8. Concurrency and presence

- **Writes:** every write loads, applies, and saves with `baseRev`. On a conflict the service reloads and re-runs the handler once.
- **Presence:** `decks.presence` is a jsonb column that does **not** bump `rev`, so watchers don't reload on every keystroke. It holds:
  - `busy: { by, until }`: set by the app when a turn starts, and by `ask`. TTL 90 s.
  - `editing: { slideId, until }`: set by the app while a slide is edited by hand. TTL 60 s, renewed while editing.
- **Rules while someone else is busy or editing:**
  - A direct write still applies, with a `notice`.
  - `ask` returns `busy` with `fix: "retry in N s"`.
  - The app doesn't send while someone else is busy.
- **The app on a 409 (required before launch).** Today `remote.ts` gets stuck and every later autosave fails. The fix:
  1. Refetch.
  2. Diff each slide against the last copy read from the server. Slides the user changed keep the local version; the others take the server's.
  3. Save again.

## 9. Cost and limits

- Every model call inside a tool is counted in `model_usage` against the key's user, under the same daily limit as the app (`MODEL_CALLS_PER_DAY`).
- `check_storyline` is cached. Automatic shortening stays in the in-app agent only: an outside writer gets the issue and decides itself.
- **Per-key rate limit:** 60 calls a minute, counted in a Neon minute bucket (`api_rate`: `key`, `minute`, `calls`), because Vercel functions keep no memory between calls.

## 10. Files

```
src/engine/tools/      index.ts · types.ts · account.ts · guide.ts · decks.ts · choice.ts · slides.ts · checks.ts · ask.ts
src/engine/agent/      agent-prompt.ts split into sections (shared + in-app)
api/_lib/              deck-service.ts · models.ts · keys.ts · rate.ts · db.ts (+ events, presence, named, api_keys)
api/mcp/v1.ts          MCP host
api/v1/[tool].ts       REST host
src/app/               remote.ts (merge on 409, rev polling, events → edited) · Shared.tsx (polling) · account menu (key, connect)
```

## 11. Testing

- **Unit (vitest):**
  - Each handler, pure, with a fake Jev and step function.
  - A snapshot of all three schema views for every tool. Changing a published name or field fails the test unless the change only adds.
  - Token budgets for the instructions, guide, list and every card.
  - `upgrade()` for `stacked` → `stacking`.
  - Key auth: another user's deck returns `not_found`.
  - Deck-service retry on conflict.
- **Host tests:** an MCP `tools/list` and `tools/call` round trip with the SDK client (annotations, `structuredContent`, `isError`); a REST call runs the same handler.
- **Agent harness:** Claude Code over MCP on a fixed request set (new slide, surgical edit, storyline), compared with the in-app harness on fit, numbers kept and edit drift. Re-run the in-app harness for M4.
- **Browser (Playwright):**
  - The app merges after an outside write, with no stuck saves.
  - An open editor and share page show an outside write within 5 s, at that slide.
  - Presence notices appear.

## 12. Milestones

1. **M1 Contract and app.** Schema clean-up. Registry and deck service with every group except `ask`. Server model calls. API keys and the rate limit. REST host. Deck name fix. Events, presence, the 409 merge, the live editor and share page.
2. **M2 MCP.** MCP host, instructions, resources, the split prompt sections and `get_guide`. The key and connect command in the account menu. Token-budget tests (trim the chart card). Trial run with Claude Code.
3. **M3 Delegation.** `ask` on the server, with the shared chat and presence.
4. **M4 One agent.** The in-app agent runs the registry handlers with the same names: `suggest_template` plus one-call `create_slide` replace the reserve-then-`edit_slide` pair, and `patch_slide` becomes `update_slide`. Harness parity is required before merging.
5. **Later:** the fit predictor on the server, OAuth, file upload, `delete_deck`, rendering.

## 13. Risks

- **The estimated fit lets some overflow through** until the deck is opened. Mitigation: `fit: "estimated"` in every result, re-measuring in the app, the predictor later.
- **Outside agents' slide quality.** Mitigation: layers 2–3 carry the same rules and cards, `suggest_template` brings Jev, and `ask` covers weak outer agents.
- **Freezing contract quirks.** Mitigation: the clean-up in M1, before MCP ships.
- **Moving the in-app agent (M4).** Mitigation: the harness gate.
- **The chart card's size** pushes layer 3b over budget. Mitigation: trim it in M2, measured by the test.
