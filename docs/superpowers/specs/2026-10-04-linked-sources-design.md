# Linked sources (FUTURE #10, first slice)

Status: built 2026-10-04 (decided overnight).

- **One source line per slide** (FUTURE's open question). The source and the footnote can carry links written `[label](https://…)`; per-figure footnote markers (¹ ²) are left for later.
- **Only http(s)**, escaped, opening in a new tab with `rel="noopener noreferrer"`. Anything else stays text.
- **Links live only in source and footnote:** the validator says so if they appear elsewhere. Limits count the label, not the URL.
- **Clickable** in the editor, present mode and share links; a click on a link never presents or advances. PDF/print shows the label.
- **Agents:** the source field's card text says to link the page the user gave and never invent a link. Hand editing shows the raw `[label](url)`.
- Left for later: the soft check that suggests a link (#9), footnote markers per figure, and a link button in hand editing.

**Merged with main (2026-10-07).** Main built the same feature in parallel (dcff359, 95a580a); its version is kept: `mdLinked` draws links in source and footnote only (the words with a small arrow), hand editing keeps a link as a mark (`markup.ts`), and `[data-links]` makes links live in the editor, present, presenter and share views. From this branch: the validator still refuses a link outside source and footnote, and `LINK_RE` is the one link pattern `plain` uses. `md()` never draws a link.
