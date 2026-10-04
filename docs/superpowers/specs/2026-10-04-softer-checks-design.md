# Softer checks (FUTURE #9, first slice)

Status: built 2026-10-04 (decided overnight).

- **Code only, high precision, at most 2 per slide**, shown only once the slide has no fit issues. FUTURE's open question ("how many at once") is answered with 2, and in practice it's usually 0: the whole gallery passes.
- **S2:** the title claims a change ("doubled", "+12%", "vs") on a bar or line chart with no annotation, no notes and no stacking → suggest a difference, CAGR or target annotation.
- **S3:** three or more judgement words in a table's cells ("Yes", "High", "Partial") → suggest ✓ / ✗ or Harvey balls.
- **Where:** a "Could be better" section in the checks popover, below the problems (it doesn't count toward "to look at"). Over MCP, as `suggestions` on clean writes and on `check_slide`.
- **Tried and dropped:** "link the source" fired on nearly every consulting slide with a source (nagging; the source card text asks for links instead), and "a number with no comparison" contradicts the number template, which is meant to stand alone.
- Later: suggestions that need judgement (a model call), e.g. notes that would carry a cause.
