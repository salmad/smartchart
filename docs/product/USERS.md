# Users: who we build for, and the words they use

> Source: owner input plus desk research, 2026-09-28. Every claim about users links to where it was read. Quotes are verbatim;
> ones marked [S] came through a fetch summariser, so recheck them before they go on the site. Vendor statistics are flagged.
> This is the shared language for product, agent prompts and the site. Update it when research or real users say otherwise.

## Shared vocabulary

| We say | Meaning | Not |
|---|---|---|
| **The maker** | The person who builds the slide. Our user and buyer. | "creator", "designer" |
| **The room** | The people the slide is for: investors, a board, execs, a client, a boss. They decide. | "audience" in copy |
| **Make the case** | The maker's job: get the room to agree, fund, approve or act. | "present", "communicate" |
| **The point** | What the slide says in one sentence. On a consulting slide it is the title. | "message", "insight" |
| **Wall of text** | The long document the thinking lives in (Confluence, a PRD, a report). What the room won't read. | "documentation" |
| **Formatting** | Everything the maker does that is not thinking: nudging, aligning, fixing charts, fonts. What we take away. | "design" (that is ours) |
| **Checked like a partner** | Our review: does the title make the point, do the numbers back it, one point per slide, nothing missing, nothing spilling. | "AI review", "lint" |
| **Rules** | Deterministic layout rules: sizes, fit, alignment, one look across the deck. Always hold. | "templates" in copy |

Words the maker uses that we can reuse (all verbatim, sources in the pain sections below): *formatting slides, nudging boxes
around, pixel perfect, all the aligns, fractions of an inch off, tweaking font size, finish tonight, all nighters, hours and
hours, redo the entire thing, make it presentable, doesn't look out of place, default formats are just bad, not a trained
designer, generic, key message, storyline.*

Words to keep off the site: MECE, ghost deck, horizontal logic, action title (say "a title that makes the point"), SCR,
components, slots, checks, lints, JSON, 1920 × 1080.

## The core insight

**Decks exist because the room has no time to read.** People take in a proposal through slides because nobody reads walls of
text in a meeting (owner, 2026-09-28). The room scans titles and charts and decides in seconds. So a slide's job is to land one
point fast, and the maker is judged on it: polish reads as competence. One consulting manager on why clients pay for slide
production: "we'll get it done 10x faster, and without any visual mistakes, and that's all they care about"
([HN](https://news.ycombinator.com/item?id=9644095)).

Consulting firms solved this decades ago: the point in the title, one point per slide, charts that prove it, a partner's red pen
before anything leaves the building. People pay to learn it: Analyst Academy sells consulting slide courses from $247 to 4,000+
students ([site](https://www.theanalystacademy.com/all-courses/)); StrategyU's "Think Like a Strategy Consultant" is $797 with
1,400+ students ([site](https://learn.strategyu.co/p/think-like-a-strategy-consultant)); Etsy has a whole category of
"McKinsey PowerPoint templates" ([Etsy](https://www.etsy.com/market/mckinsey_powerpoint_template)).

**What we sell:** we decoded what makes consulting slides look right and read right, and built it in. Layout rules keep every
slide sized, aligned and consistent. A partner-style review checks every slide makes its point before you see it. You bring the
thinking; you get the slide a top firm would make, even if you have never made one.

## Who the user is

**Someone who has to make the case to a room that decides, and has no slide team.** They have the thinking and the numbers.
What they lack is the time, the design skill or the consulting training to turn it into slides the room gets in seconds.

Ranked by pain × frequency × willingness to pay (research ranking, 2026-09-28):

| # | Persona | Why this rank |
|---|---|---|
| 1 | **The founder** | High stakes, no designer, no training, pays with their own card. Strongest evidence. |
| 2 | **The operator** (product, strategy, BizOps, a manager with a proposal) | Makes the case upwards every week or quarter. Expensable. Includes the owner's own use: a business case or product idea for an audience. |
| 3 | **The ex-consultant** | Knows what good looks like, lost the template and the slide team. Small but a sharp judge and a loud advocate. |
| 4 | **The finance lead** (FP&A, CFO, ops) | Monthly pain, but tied to Excel and incumbents (think-cell, Macabacus). Later, after export and data import. |
| — | **The junior consultant / banker** | The most pain, but firms mandate their own templates and client data blocks adoption. Credibility and word of mouth, not first revenue. |

Not for now: sales/CS QBR decks (their need is CRM data plumbing), students, general "make me a presentation" users.

### Persona 1: The founder

- **Situation.** Pre-seed to Series A. Raising, or sending the monthly investor update, or preparing the board meeting. No designer, no analyst. The deck is due this week and the product still needs building.
- **Goal.** Get the meeting, get the money, look like someone who has it together.
- **In their words.**
  - "author a 15-18 slides deck for an investor, that alone can take about a week." ([HN](https://news.ycombinator.com/item?id=3317932))
  - "You are suddenly stop working for the startup and start working for the investor(s)." (same)
  - "I have two 15-20 slide decks to finish tonight: 1 for our board meeting tomorrow" ([HN](https://news.ycombinator.com/item?id=10449513))
  - "Pitch Decks are so subjective so opinions can make you go CRAZY!" [S] ([Indie Hackers](https://www.indiehackers.com/post/everyone-is-critiquing-landing-pages-but-what-about-your-pitch-deck-aa12224ee9))
- **Fear.** Looking amateur in front of investors; a sloppy chart undermining a good business.
- **Today.** A Canva or Pitch template, a DocSend-era deck copied from a famous raise, Gamma for a first draft, then nights of fixing. Sometimes a freelance designer at a few hundred to a few thousand.

### Persona 2: The operator

- **Situation.** A product, strategy or BizOps manager, or anyone with an idea to sell inside a company: a business case, a product proposal, a quarterly review for execs. The thinking already exists as a long document (a Confluence page, a PRD, a research report), but the room won't read it.
- **Job.** Turn the wall of text into a story the room can follow: bite-sized, visible, one point per slide (owner, 2026-09-28).
- **Goal.** Get the proposal approved; be seen as sharp by people above them.
- **In their words.**
  - "Just think it's insane how much time gets spent formatting slides." ([HN](https://news.ycombinator.com/item?id=39430872))
  - "nudging boxes around, putting talking points into a visual format, "beautifying" slides" ([HN](https://news.ycombinator.com/item?id=48518649))
  - "somebody has to spend hours and hours prepping PowerPoint slides with the info that's in Jira." ([HN](https://news.ycombinator.com/item?id=47917649))
  - "Making slides look good - I cannot do well or I don't enjoy it" ([HN](https://news.ycombinator.com/item?id=39180052))
- **Fear.** The idea dies because the deck didn't land; being the one whose slides look off next to everyone else's.
- **Today.** Pastes the report into Gemini (or ChatGPT, Copilot) and asks for a presentation, then fixes the result by hand. Or runs a research task in Claude and asks it to make the presentation: it writes an HTML deck from scratch that nothing checks, so text overflows, slides drift and the point is not in the titles (owner's own workflows, 2026-09-28). Or the company PowerPoint template, an old deck to copy from, a colleague who is "good at slides".
- **What we must do for them.** Take a long report in and give a short deck back: the story as titles, the evidence as charts and tables, nothing the room has to read twice.

### Persona 3: The ex-consultant

- **Situation.** Left a consulting firm or bank for industry or freelancing. Has the instincts, lost the template, the tools and the overnight production team.
- **Goal.** Keep producing slides at the standard they were trained to, without doing the formatting themselves.
- **In their words.**
  - "I truly miss the Title - Subtitle style that Consultants use to summarize the key message." [S] (ex-Big Four, testing Gamma: [Substack](https://colleagueinterrupted.substack.com/p/can-gamma-ai-replace-powerpoint-i))
  - The job is turning storyline notes into a slide "which doesn't look out of place from the rest of the deck"; importing into Gamma "destroys all your formatting" (ex-McKinsey manager: [HN](https://news.ycombinator.com/item?id=48520744))
- **Fear.** Their work looking like everyone else's AI output.
- **Today.** think-cell and PowerPoint by hand; a personal template library; a lot of evenings.

### Persona 4 (later): The finance lead

- **Situation.** Monthly management pack, quarterly board pack. Numbers in Excel, deliverable in PowerPoint.
- **In their words.**
  - "the data is in excel, the deliverable is a powerpoint deck, how do you link the two." ([HN](https://news.ycombinator.com/item?id=20848290))
  - "formatting a table in powerpoint is a pain in the butt, default format are just bad" (same)
  - "It took us 3 days each quarter to prepare...." [S] (a CFO on board reporting: [Proformative](https://www.proformative.com/questions/monthly-financial-reporting-template-for-board-of-directors-meeting/))
- **Blocker for us today.** Needs PowerPoint export and a way in from Excel. Evidence from this segment is thin (Reddit was not reachable); verify with interviews.

### The room (not a user, but the judge)

Board members, investors, execs, clients. They scan titles and charts, skip walls of text, and decide in seconds. Everything
we check exists to serve them: the point in the title, one point per slide, numbers that back it, nothing to decode.

## Needs and problems

Ranked by how often they came up. Each is a problem the maker states, then what they actually need.

1. **Formatting eats the time, not the thinking.** Need: go from numbers and notes to a finished slide without touching layout.
   - "I spend hours tweaking font size on the slides instead of understanding the overall goal of the talk." ([HN](https://news.ycombinator.com/item?id=4872755))
   - Survey: a typical office worker spends 7 hours a week in PowerPoint, 37% of it formatting; building and formatting charts is the top time sink (47%) (empower, n=1,102, 2020, vendor study with a published method: [PDF](https://www.empowersuite.com/hubfs/Marketing/Downloads/PowerPoint%20Studie%202020/Englisch/The%20Ultimate%20Global%20PowerPoint%20Study%20-%20empower.pdf)).
2. **Alignment and consistency hell.** Need: every slide matches, without checking by eye.
   - "You try to align things and they get fractions of an inch off" ([HN](https://news.ycombinator.com/item?id=39426150))
   - "Took me about an hour a slide I think including all the aligns." ([HN](https://news.ycombinator.com/item?id=9644140))
   - 47% of presentations don't follow the company's own design rules (empower 2020, above).
3. **Default charts and tables look bad.** Need: charts that look designed and show the point.
   - "serious people don't want thick lines, 3d charts and all that crap" ([HN](https://news.ycombinator.com/item?id=20848290))
   - "(the biggest pain being red negative numbers)" ([HN](https://news.ycombinator.com/item?id=31394118))
   - think-cell: a graphics expert at a top consulting firm took over ten hours for 48 charts in plain PowerPoint, about 3 with think-cell; changing existing charts is about 60% of chart time (vendor: [case study](https://www.think-cell.com/en/product/casestudy)).
4. **Deadline crunch.** Need: a good slide tonight, not a perfect one next week.
   - "I had to produce 50 slides - each with 4 graphs I had to calculate - in 6 hours." ([HN](https://news.ycombinator.com/item?id=9644095))
   - "3 months full time, a few all nighters working on the deck" ([HN](https://news.ycombinator.com/item?id=18236732))
5. **The review loop.** Need: a slide that survives the boss, partner or investor on the first pass.
   - "I don't think a single slide went by without hours of debate and critique by the partners." ([HN](https://news.ycombinator.com/item?id=33877666))
   - "messes up one trivial formatting detail and his boss makes him redo the entire thing." ([HN](https://news.ycombinator.com/item?id=17263428))
6. **Not a designer, never trained.** Need: taste they don't have to learn.
   - "how make your slides look beautiful without being a trained designer?" ([HN](https://news.ycombinator.com/item?id=4882039))
   - "if I had a professional designer next to me to do slides and videos then that would be better, but very few people have that." ([HN](https://news.ycombinator.com/item?id=45696168))
7. **AI slide tools look generic and don't get data.** Need: AI speed without AI look.
   - "every Gamma deck looks like a Gamma deck" [S] ([G2](https://www.g2.com/products/gamma-ai/reviews))
   - "nothing such as charts, it does not understand data" [S] (same)
   - "Does not even know how to confine within a powerpoint slide, overflows" [S] ([Trustpilot](https://www.trustpilot.com/review/gamma.app))
   - "the output still bends toward the template instead of your instructions." ([HN](https://news.ycombinator.com/item?id=46462813))
   - "The slides were clean and, yes, VERY generic." [S] ([Substack](https://nathaliehill.substack.com/p/ive-changed-my-mind-about-ai-presentation))
8. **Fixing AI output takes as long as doing it.** Need: edits that change only what was asked.
   - "asking the AI to fix it tends to affect more than intended" [S] ([G2](https://www.g2.com/products/gamma-ai/reviews))
   - "impossible to make changes. The AI agent simply does not listen" [S] ([Trustpilot](https://www.trustpilot.com/review/gamma.app))
9. **The report is too long for the room.** Need: a long document turned into a short story, one point per slide. Today: paste it into Gemini or ChatGPT and fix the output (owner's workflow, 2026-09-28). Evidence beyond the owner is still to gather.
10. **Excel in, PowerPoint out.** Need: numbers in without retyping, slides out in the format the room uses.
   - "almost impossible to copy a chart or table from excel to powerpoint without the whole formating being lost" ([HN](https://news.ycombinator.com/item?id=31394118))

## How they solve it today, and how we win

| Today | What it gets them | Where it fails them | How we win |
|---|---|---|---|
| **PowerPoint / Google Slides by hand** | Full control, the format the room expects | Hours of formatting; default charts; drift between slides (1–4) | A finished, consistent slide from a sentence. No formatting. |
| **Templates** (company, Canva, Etsy "McKinsey" packs) | A starting look | The look, not the thinking; breaks when content doesn't fit (2, 6) | Layouts that always fit your content, and a review of the point, not just the look. |
| **think-cell / Macabacus / UpSlide** | Proper charts and number checks inside PowerPoint | Still manual; consultant-grade learning curve; checks numbers, not the argument (3) | The chart and the argument in one step, no training. |
| **AI slide tools** (Gamma, Beautiful.ai, Pitch, Plus AI, Presentations.AI…) | A fast first draft that looks pretty | Generic look, weak data, overflow, edits that break other things (7, 8) | Built on rules, not model luck: nothing spills, every slide matches, your numbers stay yours. |
| **Copilot in PowerPoint** | AI where they already work | Same-looking layouts; a separate, general review you run yourself (reported: [note.com](https://note.com/kagen_shin/n/n69f9b6f767df), unverified) | The partner-style review runs on every slide, before you see it, with consulting standards. |
| **Gemini / ChatGPT / Claude: "make this report a presentation"** | A first cut of the story from a long document or a research run | Generic slides, walls of bullets; HTML decks written from scratch that nothing checks, so they overflow and drift; then hand fixing | The report becomes a story: the point in each title, evidence as real charts, checked before you see it. |
| **A designer, analyst or slide team** | Real quality | Cost, wait, availability; most makers have none (6) | That standard in a minute, for everyone. |

### What competitors say, and what nobody says

Everyone sells **speed** ("in minutes", "10x faster"), **pretty** ("beautiful", "stunning") and **on-brand**. Headlines,
fetched 2026-09-28: Beautiful.ai "A faster way to create professional presentations"; Pitch "Create slides that win.";
Presentations.AI "High-Quality AI Presentations in Minutes"; Decktopus "World's #1 AI Presentation Tool"; think-cell
"Impactful presentations start with thinkcell"; UpSlide "Turn AI Drafts Into Deliverables You Can Stand Behind". Closest to us:
Perceptis, "Turn a prompt into a board-ready deck" with "consulting-grade storyline" ([site](https://perceptis.ai)), and
Deckary, "The AI presentation maker for business professionals".

Refetched 2026-09-28 for the hero decision: Gamma "Effortless AI design for presentations, websites, and more." (via
search; homepage blocks crawlers); Canva "Presentations to engage and inspire" / "anything but boring"
([site](https://www.canva.com/presentations/)); Beautiful.ai "Smart Slides are your built-in designer … spacing, alignment,
and hierarchy stay perfect" ([site](https://www.beautiful.ai)); Pitch "Create slides that win." ([site](https://pitch.com));
Plus AI "Create, refine, present." ([site](https://www.plusai.com/)); Presentations.AI "Why do most presentations lead to
nothing?" ([site](https://www.presentations.ai)); Perceptis "The Science and The Art of Executive Presentation", "board-ready",
"consulting-grade storyline" ([site](https://perceptis.ai)).

**Already taken, so not a differentiator on its own:** perfect alignment and spacing (Beautiful.ai), on-brand (everyone),
speed (everyone), "board-ready", "consulting-grade" and "science" (Perceptis). We can still say them, but only next to
what is ours.

Nobody claims, and we can (verification, not generation, is the gap):
1. **Layout that holds by rule, not by luck.** Nothing overflows, everything aligns, every slide matches.
2. **Your numbers, kept.** Every figure you gave is on the slide; nothing invented.
3. **A partner's review, built in.** Before you see it: does the title make the point, does the chart prove it, one point per slide.
4. **It argues your point.** Others sell decks; we sell the case.
5. **Restraint as taste.** Others sell "beautiful"; we sell the quiet look a partner signs off.

Warning from the market: Tome reached 20M users on "fast, pretty AI slides" and shut down its slide product in April 2025
([VentureBeat](https://venturebeat.com/technology/tomes-founders-ditch-viral-presentation-app-with-20m-users-to-build-ai)).
Fast and pretty is not a business on its own; the argument and the rigour are.

## Opportunity: be the slide engine for their AI

The operator already does the thinking with an AI (Claude research, Gemini, ChatGPT). What's missing is the last step: a deck
that is designed and checked. If their assistant can hand the content to SmartChart (an MCP server or API: "connect your
agents", on the roadmap), we become the step after research instead of another chat to paste into. The same design and checks
run whoever writes the content. This is the product principle "the agent configures, never designs" offered to other agents.

## Risks and gaps

- **No PowerPoint export yet.** Personas 2–4 live in PowerPoint and most rivals sell "editable PPTX". Likely the top objection after the first wow.
- **Evidence gaps.** Reddit and Wall Street Oasis were unreachable; FP&A and QBR voices are thin. Next: 5–8 interviews (2 founders, 3 operators, 2 ex-consultants), and open the Reddit threads by hand.
- **Stats to avoid.** "30 million presentations a day" (a 2001 Microsoft estimate with no method), "$250M a day wasted on bad PowerPoint" (every input assumed), Atlassian "31 hours a month in meetings" (a 1998 study), unsourced "40% of PowerPoint time is formatting" quotes.
