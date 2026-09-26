/* Accent picker: a bar button and a popover with curated swatches, a custom colour and a hex field.
   Swatches show the colour as the slides will draw it on the current palette (v5/accent.js). */
import { accentOn, semanticClash } from "../v5/accent.js";

// Curated: distinct hues that stay clear of the palettes' problem red and gain green.
const PRESETS = [["Gold", "#E8B94A"], ["Cobalt", "#2447D1"], ["Sky", "#0EA5E9"], ["Violet", "#7C5CFF"], ["Magenta", "#D946EF"], ["Teal", "#14B8A6"]];
const HEX = /^#?([0-9a-f]{6})$/i;

/** The palette's own tokens, read from slides.css. */
function palette(theme) {
  const probe = document.createElement("div");
  probe.className = `theme-${theme}`; probe.hidden = true; document.body.append(probe);
  const cs = getComputedStyle(probe), out = { bg: cs.getPropertyValue("--bg").trim(), focus: cs.getPropertyValue("--focus").trim().toUpperCase() };
  probe.remove();
  return out;
}

/** get() → { accent, theme }; set(hex | null) with null for the palette default. Returns sync(). */
export function accentPicker({ button, panel, get, set }) {
  panel.innerHTML = `
    <div class="accent-head"><span>Accent</span><button type="button" data-reset>Palette default</button></div>
    <div class="swatches">${PRESETS.map(([name, hex]) => `<button type="button" class="sw" data-hex="${hex}" aria-label="${name}" title="${name}"></button>`).join("")}
      <label class="sw custom" title="Custom colour"><input type="color" aria-label="Custom colour" /></label></div>
    <label class="hex"><i></i><input spellcheck="false" maxlength="7" aria-label="Hex colour" /></label>
    <p class="accent-note" hidden></p>`;
  const $ = (sel) => panel.querySelector(sel), hexInput = $(".hex input"), picker = $(".custom input");

  const open = (on) => {
    panel.hidden = !on; button.setAttribute("aria-expanded", on);
    if (on) (panel.querySelector('.sw[aria-pressed="true"]') || hexInput).focus();
  };
  button.onclick = () => open(panel.hidden);
  document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) open(false); });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { open(false); button.focus(); } });

  panel.querySelectorAll(".sw[data-hex]").forEach((b) => (b.onclick = () => set(b.dataset.hex)));
  $("[data-reset]").onclick = () => set(null);
  picker.oninput = () => set(picker.value.toUpperCase());
  hexInput.onkeydown = (e) => { if (e.key === "Enter") hexInput.blur(); };
  hexInput.onchange = () => { const m = hexInput.value.trim().match(HEX); if (m) set(`#${m[1].toUpperCase()}`); else sync(); };

  function sync() {
    const { accent, theme } = get(), pal = palette(theme), chosen = accent || pal.focus;
    const drawn = (hex) => accentOn(hex, pal.bg).focus, shown = drawn(chosen);
    button.style.setProperty("--sw", shown);
    $(".hex i").style.setProperty("--sw", shown);
    panel.querySelectorAll(".sw[data-hex]").forEach((b) => {
      b.style.setProperty("--sw", drawn(b.dataset.hex));
      b.setAttribute("aria-pressed", b.dataset.hex === chosen);
    });
    const custom = !PRESETS.some(([, hex]) => hex === chosen);
    $(".custom").classList.toggle("on", custom);
    $(".custom").style.setProperty("--sw", shown);
    picker.value = chosen.toLowerCase();
    if (document.activeElement !== hexInput) hexInput.value = chosen;
    $("[data-reset]").hidden = !accent;
    const clash = semanticClash(chosen), note = $(".accent-note");
    note.textContent = clash ? `Close to the ${clash === "neg" ? "red that marks problems" : "green that marks gains"}; highlights may read that way.`
      : shown !== chosen ? `Drawn as ${shown} on ${theme === "ink" ? "Ink" : "Paper"} so it stays legible.` : "";
    note.classList.toggle("warn", !!clash);
    note.hidden = !note.textContent;
  }
  return sync;
}
