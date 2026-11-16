/* What every MCP client keeps in context (layer 1): what Occam is, the rules all pages share, and which guide to read.
   Each kind's steps and rules live in its get_guide (layer 2), so an agent only loads the kind it works on.
   Keep it well under 2,000 characters: some clients cut longer instructions. */
export const INSTRUCTIONS = `Occam makes three kinds of page, all in workspaces (list_workspaces): slide decks, docs and roadmaps. Each has its own tools and rules.

Before your first write to a kind, read its guide once with get_guide: style "consulting" or "pitch" for a deck (get_deck shows which), "doc" for a doc, "roadmap" for a roadmap. The guide gives that kind's steps, rules and checks.

Start from list_decks, list_docs or list_roadmaps (or create_deck, create_doc, create_roadmap). Give the user the page's editor link (links.edit) so they can watch it change live.

Always: pass the user's own words as request on every write. Use the ids from the last result, never positions. If the request is unclear, ask before writing. Remove or replace anything only when the user asked. Pages nest: parent on create, move_page to move.`;
