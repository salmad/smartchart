# Checks that reach the agent unasked (FUTURE #8, plus a slice of #11)

Status: built 2026-10-04 (decided overnight). Prerequisite for #12 (red-pen review) and #13 (the slide engine behind every agent).

## Decisions
- **Every write returns `next`**: one or two sentences on the next step. Issues → fix with the smallest edit. Warnings or failed checks → weigh them, fix what a small edit fixes, tell the user the rest, never invent a source or figure. No issues → check_slide when the slide says what was asked. On a new slide, once the deck has 2+ content slides → check_storyline when the set is done. Open comments on the slide → address only if asked.
- **What runs on every write:** the rule checks (cheap, already there). Model checks (check_slide, check_storyline) stay on request; `next` says when they're worth it. This answers FUTURE #8's open question.
- **Never silent:** when code sets an explicit chart choice (a mark, stacking) back to "auto" because the user didn't name it, the result says so in `warnings`, with what to do (CLAUDE.md: checks warn, never silently rewrite).
- **#11 wording fixes:** R8 ("add the source the user gave, or ask them for one; never invent one"); R11 ignores spans of time and names the fix; the chart card says a line labels only its last point.
- Left for later (changes check logic behind the locked fixtures): R4 for pitch subtitles and column focus, R13 on criteria tables, J2 and J5, `auto` focus picking a column.

## Measuring
Rerun `npm run eval:mcp -- --against=2026-10-04-pass1` (needs the Claude subscription and the dev server). Not run overnight.
