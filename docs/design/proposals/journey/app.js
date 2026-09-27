/* Journey prototype: chat → slide appears → edit by prompt → checks list → full screen.
   Live mode runs the hybrid agent (agent.js). Without the model proxy, recorded runs are replayed. */
import { contexts, esc, mountSlide } from "../v5/render.js";
import { fitIssues, layoutLints } from "../v5/lints.js";
import { upgrade } from "../v5/schema.js";
import { runTurn } from "./agent.js";
import { judgmentChecks, ruleChecks } from "./checks.js";
import { startPresentation } from "./present.js";
import { deckList, deckName, loadStore, newDeckId, saveStore } from "./decks.js";
import { accentPicker } from "./accent-picker.js";
import { suggest } from "./suggest.js";

const $ = (id) => document.getElementById(id);
const state = { style: "consulting", theme: "ink", accent: null, items: [], current: 0, turns: [], history: [], working: new Set(), busy: false, live: false, replay: null, pills: {} };
window.__journey = state; // read by the recording script

const SUGGEST = {
  consulting: [
    "Our SaaS revenue grew from £2.1m in 2022 to £9.4m in 2025 while monthly churn fell from 8% to 3%",
    "Compare our three pricing plans: Starter £29, Growth £99, Enterprise custom, by seats, support and SLA",
    "Plan for the next 18 months: pilot with 5 hospitals, certify, then roll out nationally",
  ],
  pitch: [
    "The problem: independent cafés lose 11 hours a week to supplier ordering",
    "Our traction: 40 paying cafés, £38k MRR, growing 22% a month",
    "Why we win: suppliers compete for orders instead of cafés chasing suppliers",
  ],
};

const deck = () => ({ style: state.style, theme: state.theme, accent: state.accent, footer: footer(), slides: state.items.map((i) => i.slide) });
const footer = () => { const c = state.items.find((i) => i.slide.template === "cover"); return c ? c.slide.title.replace(/\[\[|\]\]/g, "") : "SmartChart · Draft"; };

/* Measure a slide at 1920×1080 in the hidden frame: layout issues and title line count. */
function measure(slide, d = deck(), i = state.current) {
  const frame = $("measure"), dd = { ...d, slides: d.slides.slice() };
  dd.slides[i] = slide;
  const el = mountSlide(frame, slide, contexts(dd)[i] || { page: i + 1, section: 0, kicker: "", footer: d.footer }, dd);
  const t = el.querySelector(".title");
  measure.lines = t ? Math.round(t.clientHeight / parseFloat(getComputedStyle(t).lineHeight)) : 1;
  const lint = layoutLints(el, d.style);
  measure.warnings = lint.warnings;
  return [...fitIssues(el, d.style), ...lint.issues];
}

/* Measure for the agent: `slides` is the agent's deck (a reserved slide has no JSON yet). */
function measureIn(slides, slide, index) {
  const list = slides.map((s, i) => (i === index ? slide : s.slide));
  const d = { ...deck(), slides: list.filter(Boolean) }, at = list.slice(0, index).filter(Boolean).length;
  const issues = measure(slide, d, at);
  measureIn.lines = measure.lines; measureIn.warnings = measure.warnings;
  return issues;
}

/* ─────────── Rendering ─────────── */
function mountInto(frame, i) {
  const d = deck();
  mountSlide(frame, d.slides[i], contexts(d)[i], d);
}

function render() {
  document.querySelectorAll("#style button").forEach((b) => { b.setAttribute("aria-pressed", b.dataset.v === state.style); b.disabled = state.items.length > 0 || !!state.replay; });
  document.querySelectorAll("#theme button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === state.theme));
  syncAccent();
  $("present").disabled = !state.items.length;
  document.body.classList.toggle("is-replay", !!state.replay);
  $("empty").hidden = state.items.length > 0;
  const canvas = $("canvas");
  canvas.querySelector(".slide")?.remove();
  if (state.items.length) { const host = document.createElement("div"); canvas.append(host); mountInto(host, state.current); canvas.append(host.firstElementChild); host.remove(); fitCanvas(); }
  renderStrip(); renderChecks(); renderChips();
  $("input").disabled = state.busy || !state.live || !!state.replay;
  $("send").disabled = state.busy || !state.live || !!state.replay;
  canvas.classList.toggle("busy", state.busy);
  renderDecks();
  persist();
}

function fitCanvas() { const s = $("canvas").querySelector(".slide"); if (s) s.style.setProperty("--s", $("canvas").clientWidth / 1920); }
new ResizeObserver(fitCanvas).observe($("canvas"));

function renderStrip() {
  const strip = $("strip");
  if (!state.items.length) { strip.innerHTML = ""; return; }
  strip.innerHTML = `<h3>Deck · ${state.items.length} slide${state.items.length > 1 ? "s" : ""}</h3><div class="thumbs">${state.items.map((it, i) => `
    <button class="thumb" data-i="${i}" aria-current="${i === state.current}"><div class="tf"></div>
    <span><b>${String(i + 1).padStart(2, "0")}</b>${it.slide.template}${it.status === "draft" ? '<i class="draft">draft</i>' : ""}</span></button>`).join("")}</div>`;
  strip.querySelectorAll(".thumb").forEach((b) => {
    const tf = b.querySelector(".tf"), i = +b.dataset.i;
    mountInto(tf, i);
    b.onclick = () => { state.current = i; render(); };
  });
}

function renderChecks() {
  const it = state.items[state.current], box = $("checks");
  if (!it) { box.innerHTML = ""; return; }
  const errs = (it.errors || []).map((e) => ({ id: "fit", ok: false, bad: true, msg: e }));
  const warns = (it.warnings || []).map((w) => ({ id: "rule", ok: false, msg: w }));
  const list = [...errs, ...(it.checks || []), ...warns];
  const passed = list.filter((c) => c.ok).length;
  box.innerHTML = `<h3>Checks <span>${it.checksPending ? '<i class="spinner"></i>judging…' : `${passed}/${list.length} pass`}</span></h3>
    <ul>${list.map((c) => `<li class="${c.ok ? "ok" : c.bad ? "bad" : "warn"}"><span class="ico">${c.ok ? "✓" : c.bad ? "✕" : "!"}</span><code>${esc(c.id)}</code><span>${esc(c.msg)}</span></li>`).join("")}</ul>`;
}

/* Pills: starter prompts on an empty deck; after that, next steps tailored to the current slide and the
   conversation (suggest.js), fetched in the background and kept per slide version. */
function renderChips() {
  const chips = $("chips"), it = state.items[state.current];
  if (state.replay || !state.live || state.busy) { chips.innerHTML = ""; return; }
  let list = SUGGEST[state.style].map((s) => ({ label: s, prompt: s }));
  if (it) {
    const got = state.pills[it.id];
    if (!got || got.key !== JSON.stringify(it.slide)) { refreshPills(it); return; }
    if (got.pending) { chips.innerHTML = `<span class="chips-pending"><i class="spinner"></i>Suggesting next steps…</span>`; return; }
    list = got.pills;
  }
  chips.innerHTML = list.map((p, i) => `<button type="button" data-i="${i}" title="${esc(p.prompt)}">${esc(p.label)}</button>`).join("");
  chips.querySelectorAll("button").forEach((b) => (b.onclick = () => send(list[+b.dataset.i].prompt)));
}

function refreshPills(it) {
  const key = JSON.stringify(it.slide), entry = { key, pending: true, pills: [] };
  state.pills[it.id] = entry;
  renderChips();
  suggest({ slide: it.slide, style: state.style, history: state.history, checks: it.checks || [] }).then(({ pills }) => {
    if (state.pills[it.id] !== entry) return; // the slide changed while we waited
    Object.assign(entry, { pending: false, pills });
    renderChips();
  });
}

/* ─────────── Thread ─────────── */
function addMessage(kind, html) {
  const el = document.createElement("div");
  el.className = `msg ${kind}`; el.innerHTML = html;
  $("thread").append(el); $("thread").scrollTop = 1e9;
  return el;
}
const traceHTML = (trace, pending) => `<ul class="trace">${trace.map((t) => `<li><b>${esc(t.step)}</b><span>${esc(t.detail)} <i>· ${esc(t.model)}</i></span><em>${t.ms ? `${(t.ms / 1000).toFixed(1)}s` : ""}</em></li>`).join("")}${pending ? `<li class="pending"><b>${esc(pending)}</b><span></span><em></em></li>` : ""}</ul>`;
const paragraphs = (t) => String(t || "").split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join("");

/* ─────────── Send ─────────── */
async function send(text) {
  text = text.trim();
  if (!text || state.busy) return;
  return sendAgent(text);
}

/* Agent turn: the agent works on its own copy of the deck; every applied write shows at once.
   Judgment checks run after the reply, on the slides written this turn (spec 9.4). */
async function sendAgent(text) {
  $("input").value = "";
  state.busy = true; render();
  addMessage("user", `<p>${esc(text)}</p>`);
  const bot = addMessage("bot", `<p class="sub"><i class="spinner"></i>Working…</p>`);
  const trace = [], t0 = performance.now(), before = structuredClone(state.items);
  const log = (step) => { trace.push(step); bot.innerHTML = traceHTML(trace, "Working"); $("thread").scrollTop = 1e9; };
  const adeck = { style: state.style, theme: state.theme, slides: state.items.map((it) => ({ id: it.id, slide: it.slide, issues: it.errors || [], warnings: it.warnings || [], checks: it.checks || [] })) };
  const cur = state.items[state.current];
  const sync = (d, focusId) => {
    state.items = d.slides.filter((s) => s.slide).map((s) => ({ id: s.id, slide: s.slide, status: s.issues.length ? "draft" : "ok", errors: s.issues, warnings: s.warnings, checks: s.checks || [], checksPending: false }));
    const i = state.items.findIndex((it) => it.id === focusId);
    if (i >= 0) state.current = i;
    render();
  };
  const measureAgent = (slide, index) => { const r = measureIn(adeck.slides, slide, index); measureAgent.lines = measureIn.lines; measureAgent.warnings = measureIn.warnings; return r; };
  try {
    const r = await runTurn({ text, deck: adeck, history: state.history, working: state.working, selection: cur ? { slideId: cur.id } : null, measure: measureAgent, log, onChange: sync });
    sync(adeck, r.written.at(-1) || state.items[state.current]?.id);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    bot.innerHTML = `${paragraphs(r.reply)}<p class="sub">${r.modelCalls} model call${r.modelCalls === 1 ? "" : "s"} · ${r.toolCalls} tool call${r.toolCalls === 1 ? "" : "s"} · ${secs}s</p>${traceHTML(trace)}`;
    state.items.forEach((it, i) => { measure(it.slide, deck(), i); it.checks = [...ruleChecks(it.slide, state.style, measure.lines), ...(it.checks || []).filter((c) => c.id.startsWith("J"))]; });
    state.busy = false; render();
    const turn = { request: text, reply: r.reply, trace, modelCalls: r.modelCalls, toolCalls: r.toolCalls, ms: Math.round(performance.now() - t0), pre: { intent: r.pre.intent, p: r.pre.p }, written: r.written, before, current: state.current };
    await Promise.all(r.written.map((id) => runChecks(state.items.find((it) => it.id === id))));
    turn.items = structuredClone(state.items);
    state.turns.push(turn);
  } catch (e) {
    bot.className = "msg bot error";
    bot.innerHTML = `<p>Something went wrong: ${esc(e.message || e)}</p>${traceHTML(trace)}`;
    state.busy = false; render();
    state.turns.push({ request: text, error: String(e.message || e), trace, ms: Math.round(performance.now() - t0), before, items: structuredClone(state.items) });
  }
}

async function runChecks(item) {
  if (!item) return;
  const i = state.items.indexOf(item);
  measure(item.slide, deck(), i);
  const rules = ruleChecks(item.slide, state.style, measure.lines);
  item.checks = rules; item.checksPending = true; render();
  try { item.checks = [...rules, ...(await judgmentChecks(item.slide, state.style)).checks]; }
  catch (e) { item.checks = [...rules, { id: "J", ok: false, msg: `judgment checks failed: ${e.message}` }]; }
  item.checksPending = false;
  render();
}

/* ─────────── Replay (no proxy: e.g. the Vercel deploy) ─────────── */
/* Rule checks are recomputed with the current code; Jev's judgments are kept as recorded. */
function loadSnapshot(items, current) {
  state.items = structuredClone(items).map((it) => ({ ...it, slide: upgrade(it.slide) })); state.current = current;
  const d = deck();
  state.items.forEach((it, i) => { measure(it.slide, d, i); it.checks = [...ruleChecks(it.slide, state.style, measure.lines), ...(it.checks || []).filter((c) => c.id.startsWith("J"))]; it.checksPending = false; });
  render();
}

function showReplay(run) {
  state.replay = run; state.style = run.style; state.theme = run.theme || "ink";
  $("thread").innerHTML = ""; $("thread").classList.add("replaying");
  run.turns.forEach((t, k) => {
    addMessage("user", `<p>${esc(t.request)}</p>`).onclick = () => loadSnapshot(t.items, t.current);
    // Pipeline recordings store { what, sub }; agent turns store the reply text.
    const reply = typeof t.reply === "string" ? paragraphs(t.reply) : `<p>${esc(t.reply?.what || "")}</p><p class="sub">${esc(t.reply?.sub || "")}</p>`;
    addMessage("bot", `${reply}${traceHTML(t.trace)}`);
  });
  const last = run.turns.at(-1);
  addMessage("bot", `<p class="sub">Recorded run with the real models (GLM 5.3 Flash + Jev), replayed without calling them. Click a request to see the deck at that point. Run the local server for live mode.</p>`);
  loadSnapshot(last?.items || [], last?.current || 0);
}

/* ─────────── Decks (live mode, saved in this browser) ─────────── */
const store = loadStore();
let deckId = null, saveTimer = 0, storageWarned = false;

function persist() {
  if (state.replay || !deckId || state.busy) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!state.items.length && !state.history.length) return; // an empty deck is not kept
    store.decks[deckId] = { id: deckId, style: state.style, theme: state.theme, accent: state.accent, current: state.current,
      items: state.items.map(({ checksPending, ...it }) => it), history: state.history, working: [...state.working],
      thread: $("thread").innerHTML, updated: Date.now() };
    store.active = deckId;
    if (!saveStore(store) && !storageWarned) {
      storageWarned = true;
      addMessage("bot error", "<p>This browser's storage is full, so this deck is not being saved. Delete a deck you no longer need.</p>");
    }
    renderDecks();
  }, 250);
}

function renderDecks() {
  const sel = $("decks");
  sel.hidden = !!state.replay || !state.live;
  sel.disabled = state.busy;
  $("delete").hidden = sel.hidden;
  $("delete").disabled = state.busy;
  if (sel.hidden) return;
  const list = deckList(store);
  if (deckId && !store.decks[deckId]) list.unshift({ id: deckId, items: state.items }); // new, not saved yet
  sel.innerHTML = list.map((d) => { const n = (d.id === deckId ? state.items : d.items || []).length;
    return `<option value="${d.id}"${d.id === deckId ? " selected" : ""}>${esc(deckName(d.id === deckId ? { items: state.items } : d))} · ${n} slide${n === 1 ? "" : "s"}</option>`; }).join("");
}

const welcome = () => addMessage("bot", `<p>Describe a slide. The agent picks a template with Jev, writes the slide with GLM 5.3 Flash and fixes anything that does not fit. Then ask for changes, add slides, or press <b>Present</b>.</p>`);

function openDeck(id) {
  const d = store.decks[id];
  deckId = id; store.active = id;
  Object.assign(state, { style: d.style, theme: d.theme, accent: d.accent || null, history: d.history || [], working: new Set(d.working || []), turns: [] });
  $("thread").innerHTML = d.thread || "";
  if (!d.thread) welcome();
  $("thread").scrollTop = 1e9;
  loadSnapshot(d.items || [], d.current || 0); // re-runs rule checks with the current code
}

function newDeck() {
  deckId = newDeckId();
  Object.assign(state, { items: [], current: 0, turns: [], history: [], working: new Set() });
  $("thread").innerHTML = ""; welcome();
  render();
}

function deleteDeck() {
  if (state.busy || !confirm(`Delete “${deckName({ items: state.items })}”? This cannot be undone.`)) return;
  delete store.decks[deckId];
  deckId = null; saveStore(store);
  const next = deckList(store)[0];
  next ? openDeck(next.id) : newDeck();
}

async function boot() {
  await document.fonts.ready;
  try { const h = await (await fetch("/api/health")).json(); state.live = !!h.live; } catch { state.live = false; }
  $("mode").textContent = state.live ? "Live · agent" : "Recorded run";
  $("mode").classList.toggle("live", state.live);
  if (!state.live) {
    try {
      const { runs } = await (await fetch("replays.json")).json();
      const sel = $("replay"); sel.hidden = false;
      sel.innerHTML = runs.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join("");
      sel.onchange = () => showReplay(runs[+sel.value]);
      showReplay(runs[0]);
    } catch { addMessage("bot error", "<p>No live models and no recorded runs found. Start the local server: <code>node docs/design/proposals/journey/server.mjs</code></p>"); }
    render();
  } else {
    const last = store.decks[store.active] || deckList(store)[0];
    last ? openDeck(last.id) : newDeck();
  }
}

/* ─────────── Controls ─────────── */
document.querySelectorAll("#style button").forEach((b) => (b.onclick = () => { state.style = b.dataset.v; render(); }));
document.querySelectorAll("#theme button").forEach((b) => (b.onclick = () => { state.theme = b.dataset.v; render(); }));
const syncAccent = accentPicker({ button: $("accent-btn"), panel: $("accent-panel"),
  get: () => ({ accent: state.accent, theme: state.theme }), set: (hex) => { state.accent = hex; render(); } });
$("reset").onclick = () => { if (!state.busy) newDeck(); };
$("decks").onchange = (e) => { if (!state.busy && store.decks[e.target.value]) openDeck(e.target.value); };
$("delete").onclick = deleteDeck;
// Clear chat: the agent forgets the conversation; the deck stays.
$("clear").onclick = () => { if (state.busy) return; state.history = []; state.working = new Set(); $("thread").innerHTML = ""; addMessage("bot", "<p class=\"sub\">Chat cleared. The deck is kept; the agent starts a new conversation.</p>"); persist(); };
$("composer").onsubmit = (e) => { e.preventDefault(); send($("input").value); };
$("input").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("input").value); } };
const present = () => state.items.length && startPresentation(deck(), state.current, (i) => { state.current = i; render(); });
$("present").onclick = present;
$("canvas").onclick = present;
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA" || !$("presentation").hidden) return;
  if (e.key === "f") present();
  if (e.key === "ArrowRight" && state.current < state.items.length - 1) { state.current++; render(); }
  if (e.key === "ArrowLeft" && state.current > 0) { state.current--; render(); }
});

window.__journey.send = send;
window.__journey.setStyle = (v) => { state.style = v; render(); };
window.__journey.load = (slides, style) => {
  state.style = style; state.history = []; state.working = new Set(); state.turns = [];
  state.items = slides.map((s, i) => ({ id: `s_t${i}`, slide: upgrade(s), status: "ok", errors: [], warnings: [], checks: [], checksPending: false }));
  state.current = 0; render();
};
boot();
