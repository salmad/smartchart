# Comments that agents pick up

FUTURE.md #3. Status: design, 2026-10-04. Decided autonomously overnight; the open questions from FUTURE.md are answered below with the simplest choice that works.

## Why

Reviewing a deck is how consultants work: a partner scribbles "this number is from Q2, update it" or "too wordy" on page 7. Today the maker has to retype each note into the chat. With comments, notes live on the slide where they belong, and any agent can work through them: SmartChart's own agent, or Claude/Cursor over MCP. Each note comes back resolved, with a reply saying what was done. No other slide tool closes that loop.

## Decisions (the FUTURE.md questions)

| Question | Decision | Why |
|---|---|---|
| What a comment anchors to | A slide. The text names the part ("the second card"). | Paths change when items are added or removed; agents read the slide anyway. A path anchor can come later. |
| Automatic or on request | On request. Agents act on comments when the user asks ("address the comments"), or from one click ("Ask SmartChart"). | Comments are input written by people: requests to weigh, not commands. They never act on their own. |
| How MCP exposes them | Open comments in `get_deck` (all) and `read_slide` (that slide); a `resolve_comment` tool with a reply. | One new tool. Agents already call get_deck first. |
| Share-link viewers | Not in this slice. | Needs identity and abuse handling; the owner's own review loop comes first. |

## Model

Deck-level, beside the slides (not inside slide JSON, so slides and their version hashes stay content-only):

```ts
interface DeckComment { id: string; slideId: string; text: string; by: string; at: number
  done?: { by: string; at: number; reply?: string } }
```

- Stored in the deck's data as `comments` (no migration; decks are JSON).
- A comment on a deleted slide stays and shows as "on a deleted slide" until it is resolved.
- When writes merge (an agent over MCP resolved a comment while the app was open), comments merge by id: the union of both, and a comment resolved on either side is resolved.

## Agents

- **In-app.** The deck state lists open comments (`c_ab12 on s_x1: "text" (by Sam)`). A new tool, `resolve_comment { commentId, reply }`, and a prompt section: act on comments only when asked; make the change first, then resolve with a one-line reply; if a comment is unclear or would remove something, ask instead and leave it open; you may resolve without a change only if the reply says why.
- **MCP.** `get_deck` returns `comments` (open ones); `read_slide` returns that slide's open comments; `resolve_comment { deckId, commentId, reply }`. The server instructions and `get_guide` say the same as the in-app prompt, in one line each.
- Thin harness: code stores, lists and resolves. Whether and how to act is the model's call, as with checks.

## App

- **Comment button** on the row under the slide (beside the checks): a speech-bubble icon with the open count. It opens a popover for the current slide: open comments (author, time, text, Resolve, Delete), a box to add one (Enter adds; Shift+Enter is a new line), resolved ones folded below with the reply, and "Ask SmartChart to address these" when the models are up.
- **Strip**: a thumbnail with open comments gets a small count badge.
- **Author**: the account's name, else the email's local part. Agents sign as SmartChart or the MCP client's name.
- Locked while a turn runs or a slide is being edited, like every other write.

## Not in this slice

Path anchors and pins on the slide, @mentions and notifications, comments from share links, a deck-wide comments list.

## Tests

- Unit: the merge rule; doc ↔ data round trip; MCP `get_deck`, `read_slide`, `resolve_comment` (unknown id, already resolved); the in-app agent's `resolve_comment` and state block; the reducer and saving.
- Browser (dev account): add a comment, see the badge, resolve it, delete it.
