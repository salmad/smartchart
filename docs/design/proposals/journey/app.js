/* Journey prototype: chat → slide appears → edit by prompt → checks list → full screen.
   Live mode runs the MVP agent (agent.js); ?engine=pipeline runs the earlier fixed pipeline.
   Without the model proxy, recorded pipeline runs are replayed. */
import { contexts, esc, fitIssues, mountSlide } from "../v5/render.js";
import { createSlide, editSlide } from "./pipeline.js";
import { runTurn } from "./agent.js";
import { judgmentChecks, ruleChecks } from "./checks.js";
import { startPresentation } from "./present.js";

const $ = (id) => document.getElementById(id);
const ENGINE = new URLSearchParams(location.search).get("engine") === "pipeline" ? "pipeline" : "agent";
const state = { style: "consulting", theme: "ink", items: [], current: 0, turns: [], history: [], busy: false, live: false, replay: null, engine: ENGINE };
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
  edit: ["Make the title punchier", "Show this as a table instead", "Add a slide with our 3-step plan to get there"],
};

const deck = () => ({ style: state.style, theme: state.theme, footer: footer(), slides: state.items.map((i) => i.slide) });
const footer = () => { const c = state.items.find((i) => i.slide.template === "cover"); return c ? c.slide.title.replace(/\[\[|\]\]/g, "") : "SmartChart · Draft"; };

/* Measure a slide at 1920×1080 in the hidden frame: layout issues and title line count. */
function measure(slide, d = deck(), i = state.current) {
  const frame = $("measure"), dd = { ...d, slides: d.slides.slice() };
  dd.slides[i] = slide;
  const el = mountSlide(frame, slide, contexts(dd)[i] || { page: i + 1, section: 0, kicker: "", footer: d.footer }, dd);
  const t = el.querySelector(".title");
  measure.lines = t ? Math.round(t.clientHeight / parseFloat(getComputedStyle(t).lineHeight)) : 1;
  return fitIssues(el, d.style);
}

/* Measure for the agent: `slides` is the agent's deck (a reserved slide has no JSON yet). */
function measureIn(slides, slide, index) {
  const list = slides.map((s, i) => (i === index ? slide : s.slide));
  const d = { ...deck(), slides: list.filter(Boolean) }, at = list.slice(0, index).filter(Boolean).length;
  const issues = measure(slide, d, at);
  measureIn.lines = measure.lines;
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

function renderChips() {
  const chips = $("chips");
  const list = state.replay || !state.live || state.busy ? [] : state.items.length ? SUGGEST.edit : SUGGEST[state.style];
  chips.innerHTML = list.map((s) => `<button type="button">${esc(s)}</button>`).join("");
  chips.querySelectorAll("button").forEach((b) => (b.onclick = () => send(b.textContent)));
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
const NEXT = { Route: "Decide", Intent: "Fill", Decide: "Fill", Fill: "Gate", Gate: "Repair", Edit: "Gate", Repair: "Repair" };

function replyText(r, before) {
  const n = r.index + 1;
  const what = r.added ? `Added slide ${n}: a ${r.slide.template} slide.` : before ? (before.template !== r.slide.template ? `Rebuilt slide ${n} as a ${r.slide.template} slide.` : `Updated slide ${n}.`) : `Here is slide ${n}: a ${r.slide.template} slide.`;
  const sub = r.status === "draft" ? `Saved as a draft: ${r.errors.length} issue${r.errors.length > 1 ? "s" : ""} could not be fixed automatically.` : "It passes validation and fits the slide.";
  return { what, sub };
}

/* ─────────── Send ─────────── */
async function send(text) {
  text = text.trim();
  if (!text || state.busy) return;
  if (state.engine === "agent") return sendAgent(text);
  $("input").value = "";
  state.busy = true; render();
  addMessage("user", `<p>${esc(text)}</p>`);
  const bot = addMessage("bot", `<p class="sub"><i class="spinner"></i>Working…</p>`);
  const trace = [], t0 = performance.now();
  const log = (step) => { trace.push(step); bot.innerHTML = traceHTML(trace, NEXT[step.step]); $("thread").scrollTop = 1e9; };
  const creating = !state.items.length;
  const index = creating ? 0 : state.current, before = state.items[index]?.slide;
  try {
    const d = deck();
    const r = creating
      ? await createSlide({ request: text, style: state.style, deck: d, index: 0, measure: (s) => measure(s, d, 0), log })
      : await editSlide({ request: text, style: state.style, deck: d, index, measure: (s) => measure(s, d, index), log });
    // A new slide goes after the current one; everything else replaces it.
    const at = r.added ? index + 1 : index;
    const item = { slide: r.slide, status: r.status, errors: r.errors, warnings: r.warnings, checks: [], checksPending: true };
    if (r.added) state.items.splice(at, 0, item); else state.items[at] = item;
    state.current = at;
    const msg = replyText({ ...r, index: at }, r.added ? null : before);
    bot.innerHTML = `<p>${esc(msg.what)}</p><p class="sub">${esc(msg.sub)} ${((performance.now() - t0) / 1000).toFixed(1)}s total.</p>${traceHTML(trace)}`;
    state.busy = false; render();
    await runChecks(item, at);
    state.turns.push({ request: text, trace, reply: msg, items: structuredClone(state.items), current: state.current });
  } catch (e) {
    bot.className = "msg bot error";
    bot.innerHTML = `<p>Something went wrong: ${esc(e.message || e)}</p>${traceHTML(trace)}`;
    state.busy = false; render();
  }
}

/* MVP agent turn: the agent works on its own copy of the deck; every applied write shows at once. */
async function sendAgent(text) {
  $("input").value = "";
  state.busy = true; render();
  addMessage("user", `<p>${esc(text)}</p>`);
  const bot = addMessage("bot", `<p class="sub"><i class="spinner"></i>Working…</p>`);
  const trace = [], t0 = performance.now();
  const log = (step) => { trace.push(step); bot.innerHTML = traceHTML(trace, "Working"); $("thread").scrollTop = 1e9; };
  const adeck = { style: state.style, theme: state.theme, slides: state.items.map((it) => ({ id: it.id, slide: it.slide, issues: it.errors || [], warnings: it.warnings || [] })) };
  const cur = state.items[state.current];
  const sync = (d, focusId) => {
    state.items = d.slides.filter((s) => s.slide).map((s) => ({ id: s.id, slide: s.slide, status: s.issues.length ? "draft" : "ok", errors: s.issues, warnings: s.warnings, checks: [], checksPending: false }));
    const i = state.items.findIndex((it) => it.id === focusId);
    if (i >= 0) state.current = i;
    render();
  };
  const measureAgent = (slide, index) => { const r = measureIn(adeck.slides, slide, index); measureAgent.lines = measureIn.lines; return r; };
  try {
    const r = await runTurn({ text, deck: adeck, history: state.history, selection: cur ? { slideId: cur.id } : null, measure: measureAgent, log, onChange: sync });
    sync(adeck, state.items[state.current]?.id);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    bot.innerHTML = `${paragraphs(r.reply)}<p class="sub">${r.modelCalls} model call${r.modelCalls === 1 ? "" : "s"} · ${r.toolCalls} tool call${r.toolCalls === 1 ? "" : "s"} · ${secs}s</p>${traceHTML(trace)}`;
    state.items.forEach((it, i) => { measure(it.slide, deck(), i); it.checks = ruleChecks(it.slide, state.style, measure.lines); });
    state.busy = false; render();
    state.turns.push({ request: text, reply: r.reply, trace, modelCalls: r.modelCalls, toolCalls: r.toolCalls, ms: Math.round(performance.now() - t0), items: structuredClone(state.items), current: state.current });
  } catch (e) {
    bot.className = "msg bot error";
    bot.innerHTML = `<p>Something went wrong: ${esc(e.message || e)}</p>${traceHTML(trace)}`;
    state.busy = false; render();
    state.turns.push({ request: text, error: String(e.message || e), trace, ms: Math.round(performance.now() - t0), items: structuredClone(state.items) });
  }
}

async function runChecks(item, i) {
  measure(item.slide, deck(), i);
  const rules = ruleChecks(item.slide, state.style, measure.lines);
  item.checks = rules; render();
  try {
    const j = await judgmentChecks(item.slide, state.style);
    item.checks = [...rules, ...j.checks];
  } catch (e) { item.checks = [...rules, { id: "J", ok: false, msg: `judgment checks failed: ${e.message}` }]; }
  item.checksPending = false;
  if (state.items[i] === item) render();
}

/* ─────────── Replay (no proxy: e.g. the Vercel deploy) ─────────── */
/* Rule checks are recomputed with the current code; Jev's judgments are kept as recorded. */
function loadSnapshot(items, current) {
  state.items = structuredClone(items); state.current = current;
  const d = deck();
  state.items.forEach((it, i) => { measure(it.slide, d, i); it.checks = [...ruleChecks(it.slide, state.style, measure.lines), ...(it.checks || []).filter((c) => c.id.startsWith("J"))]; it.checksPending = false; });
  render();
}

function showReplay(run) {
  state.replay = run; state.style = run.style; state.theme = run.theme || "ink";
  $("thread").innerHTML = ""; $("thread").classList.add("replaying");
  run.turns.forEach((t, k) => {
    addMessage("user", `<p>${esc(t.request)}</p>`).onclick = () => loadSnapshot(t.items, t.current);
    addMessage("bot", `<p>${esc(t.reply.what)}</p><p class="sub">${esc(t.reply.sub)}</p>${traceHTML(t.trace)}`);
  });
  const last = run.turns.at(-1);
  addMessage("bot", `<p class="sub">Recorded run with the real models (GLM 5.3 Flash + Jev), replayed without calling them. Click a request to see the deck at that point. Run the local server for live mode.</p>`);
  loadSnapshot(last?.items || [], last?.current || 0);
}

async function boot() {
  await document.fonts.ready;
  try { const h = await (await fetch("/api/health")).json(); state.live = !!h.live; } catch { state.live = false; }
  $("mode").textContent = state.live ? (state.engine === "agent" ? "Live · agent" : "Live · pipeline") : "Recorded run";
  $("mode").classList.toggle("live", state.live);
  if (!state.live) {
    try {
      const { runs } = await (await fetch("replays.json")).json();
      const sel = $("replay"); sel.hidden = false;
      sel.innerHTML = runs.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join("");
      sel.onchange = () => showReplay(runs[+sel.value]);
      showReplay(runs[0]);
    } catch { addMessage("bot error", "<p>No live models and no recorded runs found. Start the local server: <code>node docs/design/proposals/journey/server.mjs</code></p>"); }
  } else {
    addMessage("bot", state.engine === "agent"
      ? `<p>Describe a slide. The agent picks a template with Jev, writes the slide with GLM 5.3 Flash and fixes anything that does not fit. Then ask for changes, add slides, or press <b>Present</b>.</p>`
      : `<p>Describe a slide. I route it with Jev, write it with GLM 5.3 Flash, check it fits, and repair it if needed. Then ask for changes, add slides, or press <b>Present</b>.</p>`);
  }
  render();
}

/* ─────────── Controls ─────────── */
document.querySelectorAll("#style button").forEach((b) => (b.onclick = () => { state.style = b.dataset.v; render(); }));
document.querySelectorAll("#theme button").forEach((b) => (b.onclick = () => { state.theme = b.dataset.v; render(); }));
$("reset").onclick = () => { if (state.replay) { state.replay = null; state.items = []; $("thread").innerHTML = ""; $("replay").hidden = true; boot(); return; } state.items = []; state.turns = []; state.history = []; state.current = 0; $("thread").innerHTML = ""; boot(); };
// Clear chat: the agent forgets the conversation; the deck stays.
$("clear").onclick = () => { if (state.busy) return; state.history = []; $("thread").innerHTML = ""; addMessage("bot", "<p class=\"sub\">Chat cleared. The deck is kept; the agent starts a new conversation.</p>"); };
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
boot();
