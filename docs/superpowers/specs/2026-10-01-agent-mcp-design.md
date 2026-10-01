# SmartChart for agents: MCP (primary) and REST (secondary)

Status: design, 2026-10-01. Reviewed for one-way doors by Fable (notes folded in).

## 1. Goal

An agent such as Claude Code, or OpenClaw driven from Telegram, connects to SmartChart and works on its user's decks. It has two ways to do that:

- **Fine-grained tools:** pick a template, write a slide, edit one component of a slide, run the checks, share the deck and get its link.
- **Delegation:** `ask` sends the request to SmartChart's own agent and returns its reply.

The in-app agent and outside agents use **one set of tools**, with the same names and the same code. The post-edit code always runs on our side: autofix → validate → resolve `auto` (Jev) → fit check → rule checks. No writer can skip it.

**How it is used:** talk to Claude Code (connected over MCP) with the deck open in a browser beside it. Ask what decks you have and pick one (`list_decks` → `get_deck`), or start a new one. Claude gives you the deck's link: your own editor link (`/d/:id`, signed in) or, for others to watch, the share link. Every change shows up in the open page within seconds. There is no rendering on the server: the browser is the view.

**Decided:**
- MCP first, REST second, both generated from the same registry.
- API keys now; OAuth later. A key acts only for its own user.
- No browser on the server at all. The fit check counts characters, and the app re-measures when a deck is opened. No PNG or HTML export: the share link is the view.
- `ask` shares the deck's chat with the app.
- Public names have `v1` in them, and tools are added but never renamed.

## 2. Architecture

```
            in-app agent (GLM)     MCP client (Claude Code, OpenClaw)     REST client (scripts, skills)
                   │                          │                                   │
          OpenAI function format        /mcp/v1 (Streamable HTTP,            POST /api/v1/<tool>
                   │                    stateless, Vercel function)                │
                   └──────────────┬───────────┴───────────────────────────────────┘
                                  ▼
                        Tool registry (src/engine/tools)
            one entry per tool: name · description · JSON Schema in/out · handler
                                  ▼
                 Deck service (api/_lib/deck-service.ts, server only)
        load deck (Neon) → run the handler on the engine → write path → save with rev
                                  ▼
             Engine (framework-free): schema, write.ts, checks, story, pre, resolve
```

- **Registry** (`src/engine/tools/`): one file per tool group (section 4). An entry is `{ name, group, description, input, output, handler }`. The descriptions and schemas are the contract: the in-app agent sees them as GLM functions, MCP lists them as tools, and REST validates bodies against them. Handlers take a `ToolContext` (`deck`, `user`, `jev`, `measure`, `now`) and never touch HTTP or React.
- **Hosts** are thin adapters. The MCP host maps `tools/list` and `tools/call` to the registry. The REST host maps `POST /api/v1/<tool>` with a JSON body to the same call, and returns JSON. Both authenticate first (section 7) and count model calls (section 9).
- **The in-app agent moves onto the registry** with the same tool names (milestone M4). Until then it keeps its four tools in the browser. Both paths share `checkWrite`, so the slides they produce are equivalent.
- **Measuring on the server:** `measure` is a character-based estimate. It uses the `validate()` limits (maxChars, item counts, row budgets) and returns `fit: "estimated"`. The app already re-measures every slide in a real browser when a deck opens (`recheckRules`, `App.tsx:74`), so an overflow shows there as an amber issue. Later, the fit-spike predictor (`docs/research/2026-09-27-fit-spike`, 100% agreement with Chrome on text line counts) can replace the estimate for text, with no browser and no change to the contract.
- **Live view, editor and share page:** both load once today. Both change to poll a cheap `rev` check every 3 s while the tab is visible (and on focus), reload when `rev` changes, and move to the slide that changed. The editor merges by slide id (section 8) and never polls over a hand edit in progress. Either link can open at one slide with `?slide=n`. Watching your own deck needs no sharing.

## 3. Context: how an outside agent learns enough

Context arrives in four layers, all generated from the same source as the in-app prompt so the two cannot drift. `agent-prompt.ts` is split into named sections. The in-app prompt is all of them plus its own workflow and reply rules. Outside agents get the shared ones.

| Layer | When it arrives | What's in it |
|---|---|---|
| 1. MCP `instructions` (~300 words, always in context) | On connect | What SmartChart is. The two ways in (tools, or `ask`). The workflow: `get_guide` once per style, then `suggest_template` → `get_template` → `create_slide` → fix `issues` → `check_slide`. Offer the user the deck's editor link (from `get_deck`) so they can watch it change; the share link only when they want others to see it. Address slides by id, never by position. Write `"auto"` for choices code makes. Never set style, layout, colours, page numbers or the footer. When the user's request is unclear, ask them before writing. |
| 2. `get_guide(style)` | Once per session and style | Hard rules (every figure exactly as given, no invented data, illustrative figures marked, no made-up source, change only what was asked). Start plain. When to stop and ask (2–4 numbered options, put to your own user). Writing slide JSON (maxChars, plain numbers, markup syntax, `auto` choices, paths and patches). The style block (`STYLES[style]`). |
| 3. `list_templates(style)` / `get_template(template, style)` | When choosing and before writing | Every offered template with its summary and "use when", the picking guide (`PICKING_GUIDE`, `GUIDE`: chart vs table), and the card: fields with type, required, maxChars, item min/max and description, the template rules (`CHART_GUIDE` for charts), markup, and a worked example from the starters. |
| 4. Tool results | Every call | Write results name the path, the limit and the fix for each issue. `get_deck` gives the storyline. `read_slide` gives the JSON and what can be added, removed or moved. |

**Not passed outside:** the persona, the reply-writing rules (talking to the user is the calling agent's job), the "Working slides" block (replaced by `read_slide` and the stored slide in every write result), the selection (outside agents pass `slideId` and `path`), and the `reply` parameter.

**Choosing templates** works three ways. The agent can read `list_templates` and decide itself, call `suggest_template` (Jev, with probabilities), or name one because the user did. Template change goes through `change_template`. Layer 2 tells outside agents to change a template only when their user asked. Code does not gate it for them, because the call itself is the explicit request.

## 4. Tools (v1)

Seven groups, each with one job. **Reads never change anything. Writes always run the write path and return the same write result. Checks never change anything and are the only calls that cost Jev beyond writes.**

### 4.1 Account
| Tool | In | Out |
|---|---|---|
| `whoami` | — | `{ email, callsLeftToday }` |

### 4.2 Guide (knowledge; no deck)
| Tool | In | Out |
|---|---|---|
| `get_guide` | `style` | the layer-2 text (section 3) |
| `list_templates` | `style` | `[{ template, summary, use }]` (offered only) and `guide` (picking order, chart vs table) |
| `get_template` | `template`, `style` | `{ card, example }` |

### 4.3 Decks (deck-level state)
| Tool | In | Out |
|---|---|---|
| `list_decks` | — | `[{ deckId, name, style, slides, updated, shared }]`, newest first |
| `create_deck` | `name`, `style`, `theme?`, `accent?` | deck (as `get_deck`); the server mints the id |
| `get_deck` | `deckId` | `{ deckId, name, style, theme, accent, rev, links: { edit, share }, slides: [{ slideId, n, template, title, issues }] }`. The slide list is the storyline. |
| `update_deck` | `deckId`, `{ name?, theme?, accent? }` | deck. `style` can change only while the deck is empty. `accent` is a hex colour checked by the colour rules. |
| `share_deck` | `deckId`, `on` | `{ share: url \| null }`: the read-only link that updates live (section 2) |

### 4.4 Templates for a slide (decision help; Jev)
| Tool | In | Out |
|---|---|---|
| `suggest_template` | `deckId`, `about` (the content, in the user's words), `after?` | `{ template, probabilities, decided, after }` (pre.ts, split out of today's `create_slide`) |

### 4.5 Slides (content and structure; write path)
| Tool | In | Out |
|---|---|---|
| `create_slide` | `deckId`, `slide` (full JSON), `after?` (slideId \| `"start"` \| `"end"`), `intent?` | write result |
| `read_slide` | `deckId`, `slideId`, `path?` | `{ slide \| value, template, lists: [{ path, min, max, length }] }` (`listOps`). Content only, no checks. |
| `update_slide` | `deckId`, `slideId`, `set: { path: value }`, `intent?` | write result. Edits components: a value replaces, `null` removes, the next index appends, a whole list reorders. All or nothing. |
| `change_template` | `deckId`, `slideId`, `slide` (full JSON in the new template), `intent?` | write result (the id is kept) |
| `move_slide` | `deckId`, `slideId`, `after` | `{ slides }` (the storyline) |
| `delete_slide` | `deckId`, `slideId` | `{ deleted: slide }`. Undo is `create_slide` with it. |

**Write result:** `{ applied, slideId, n (its position), slide (as stored), issues[], warnings[], autofixes[], resolved{}, changed[], elsewhere[], fit: "estimated", rev }`. No link: a deck's share link never changes, the agent gets it once from `share_deck` or `get_deck`, and the open page jumps to the changed slide by itself.
- `issues` must be fixed.
- `warnings` are advice. Act on them only with a small edit.
- `resolved` lists the `auto` values code picked.
- `changed` (`update_slide` only) lists the paths that changed. `elsewhere` lists problems on other parts of the slide, often caused by the change.

Shape errors return `applied: false`, and nothing is written.

`intent` is the user's own words. Jev uses it for `auto` picks, and it applies the same guard as in the app: chart marks stay `auto` unless `intent` names one.

### 4.6 Checks (advisory; never change anything)
| Tool | In | Out |
|---|---|---|
| `check_slide` | `deckId`, `slideId`, `judgment?` (default false) | `{ checks: [{ id, ok, msg, p? }] }`: the rule checks, and with `judgment` the Jev checks too |
| `check_storyline` | `deckId` | `{ storyline, checks: [{ id, ok, msg, slideId?, fix? }] }` (D1–D5, cached by `storyKey`) |

### 4.7 Delegation
| Tool | In | Out |
|---|---|---|
| `ask` | `text`, `deckId?` (omit to start a new deck), `slideId?`, `path?`, `files?: [{ name, text }]`, `style?` (new deck) | `{ status: "done" \| "question", reply, options?, slides: [{ slideId, n, title, changed }], rev }` |

`ask` runs `runTurn` on the server with the deck's shared chat, so its turns appear in the app's chat marked with the client's name ("via Claude Code"), and the in-app agent knows what "that" refers to. When `status` is `"question"`, the caller relays the options to its user and answers with another `ask` on the same deck.

**Not in v1:**
- `delete_deck`: permanent, and should be done in the app.
- `duplicate_slide`: read, then create.
- Versions or undo beyond `delete_slide` returning the slide.
- Uploading binary files: the caller extracts the text.
- `get_selection` (what the user has selected in an open tab).
- Rendering (PNG or standalone HTML). The share link is the view. Can be added later as a new tool without changing any other.

## 5. The public data contract

- **Slides are the slide JSON** in `src/engine/types.ts`, addressed by paths (`chart.series[1].values[3]`, `cards[2].title`). There's no second schema. The cards describe it at runtime.
- **Decks are a public shape** built at the boundary by extending `publicDeck()` (`api/_lib/share.ts`). The app's `SavedDeck` layout (`items`, `status`, `current`, the chat) is never exposed.
- **Ids:** deck ids (minted on the server) and slide ids (`s_` + 4 characters, unique within a deck) are permanent and opaque. A slide is always addressed with its `deckId`.
- **Versioning:** every response carries `schema: "2026-10-01"`. Input goes through `upgrade()`. Fields are added, never renamed. A breaking change means `/mcp/v2` and `/api/v2`.
- **Clean-up before freezing:**
  1. `chart.stacked: boolean | "100" | "auto"` becomes `chart.stacking: "none" | "stacked" | "percent" | "auto"`, and `upgrade()` maps the old field.
  2. `focus: "auto"` disappears on read-back because it resolves into per-item flags. Document it in the card, or keep `focus` on the stored slide. Decide in the plan.
  3. Table cells (`string | { value, note }`): keep, and document in the card.
  4. `validate()` accepts the archived `number` template. Writes outside the in-app agent must refuse templates not in `OFFERED`.

## 6. Shared chat and edits from outside

- `ask` appends to the deck's `chat` column (history and messages) with the client's name.
- A direct write (`create_slide`, `update_slide` …) appends one short line to the history, e.g. "Claude Code updated s_a1b2: cards[1].title". The in-app agent then hears about it the way it hears about hand edits, and the user can see it.

## 7. Auth

- **API keys:** each user has one key, created, copied once and replaced from the account menu. It's stored hashed (`api_keys`: `hash`, `user_id`, `prefix`, `created`, `last_used`).
- `userFrom` also accepts `Authorization: Bearer sc_…`. Every query is already filtered by user id, so a key reaches only its own user's decks. Another user's deck is reachable only through a share link, which is read-only and separate from keys.
- OAuth 2.1 for MCP (needed for claude.ai connectors) comes later as an extra option. Check whether Neon Auth's Better Auth includes the MCP/OIDC provider plugin.

## 8. Concurrency

- Every write loads the deck, applies the change and saves with `baseRev`. On a conflict the service reloads and retries once; the slides are independent, so the retry nearly always succeeds.
- **The app must cope with outside writes (required before launch).** Today a 409 leaves `remote.ts` stuck, and every later autosave fails. Fix: on a 409, refetch, merge by slide id (the server's version wins for slides changed outside, the local version wins for slides the user changed), then save.
- **Soft edit lock:** while the user edits a slide by hand, the app sets `editing: { slideId, until }` on the deck (with a TTL). A write from outside still applies but returns a warning ("the user is editing s_xx right now").

## 9. Cost and limits

- Calls to Jev and GLM inside tools are counted in `model_usage` against the key's user, through the same daily limit as the app (`MODEL_CALLS_PER_DAY`).
- Judgment checks are opt-in. `check_storyline` is cached. Automatic shortening stays in the in-app agent only: an outside writer gets the issue and decides itself (checks warn, they never rewrite).
- Each key has a rate limit (e.g. 60 calls a minute) to stop a looping agent.

## 10. Errors

There's one error shape across hosts: `{ error: { code, message, fix? } }`. Codes: `unauthorized`, `not_found`, `bad_input` (with the path), `conflict`, `quota`, `refused` (e.g. an archived template). Messages are sentences an agent can act on, naming the valid ids, paths or values, as the write path does today.

## 11. Testing

- **Unit (vitest):** each registry handler against a fake database and a fake Jev; contract snapshots of every tool's schema (a change to a published name or field fails the test unless it only adds); `upgrade()` for `stacked` → `stacking`; key auth (another user's deck returns `not_found`).
- **Host tests:** MCP `tools/list` and `tools/call` round trip with the SDK client; a REST call runs the same handler.
- **Agent harness:** with Claude Code connected over MCP, run a fixed set of requests (new slide, surgical edit, storyline) and compare with the in-app harness on fit, numbers kept and edit drift. Re-run the in-app harness when the in-app agent moves onto the registry (M4).
- **Browser (Playwright):** the app merges after an outside write (no stuck saves), the soft lock warning appears, and an open editor and share page each show an outside write within 5 s and move to that slide.

## 12. Milestones

1. **M1 Contract.** Schema clean-up (section 5). The registry with deck, slide, template and check handlers over the deck service (server write path with estimated fit). API keys. REST host. The app's 409 merge and the soft lock. The live editor and share page with `?slide=n`.
2. **M2 MCP.** The MCP host on Vercel, `instructions`, `get_guide` from the split prompt sections, and the connect guide (Claude Code `claude mcp add --transport http …`, plus an OpenClaw skill). Trial run with Claude Code.
3. **M3 Delegation.** `ask` on the server with the shared chat.
4. **M4 One agent.** The in-app agent uses the registry with the same names (`suggest_template` + one-call `create_slide` replace reserve + `edit_slide`; `patch_slide` becomes `update_slide`). Harness parity required before merging.
5. **Later:** the fit predictor on the server (exact text fit), OAuth, file upload, `delete_deck`, rendering (PNG or HTML) if an outside client needs images.

## 13. Risks

- **The estimated fit lets some overflow through** until the deck is opened. Mitigation: `fit: "estimated"` in every result, re-measuring in the app, and the predictor later.
- **Outside agents' slide quality.** They don't have the in-app routing and prompt tuning. Mitigation: layers 2–3 give them the same rules and cards, `suggest_template` gives them Jev, and `ask` is there when the outer agent is weak.
- **Freezing contract quirks.** Mitigation: the clean-up in section 5 happens before M2 ships.
- **Moving the in-app agent (M4) could lower quality.** Mitigation: the harness gate.
