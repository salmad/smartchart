/* Presentation mode (spec 8): the same slides scaled to the screen with letterboxing. */
import { contexts, mountSlide } from "../v5/render.js";

export function startPresentation(deck, start, onExit) {
  const root = document.getElementById("presentation"), frame = document.getElementById("pframe"), count = document.getElementById("pcount");
  const ctx = contexts(deck), n = deck.slides.length;
  let i = start, typed = "";

  const size = () => {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    frame.style.width = `${1920 * k}px`; frame.style.height = `${1080 * k}px`;
    frame.querySelector(".slide")?.style.setProperty("--s", k);
  };
  const show = (to) => {
    i = Math.max(0, Math.min(n - 1, to));
    mountSlide(frame, deck.slides[i], ctx[i], deck); size();
    count.textContent = `${i + 1} / ${n}`;
    history.replaceState(null, "", `#/${i + 1}`);
  };
  // Leaving full screen (Esc, F) leaves the presentation and returns to the same slide.
  const onFull = () => { if (!document.fullscreenElement) exit(); };
  const exit = () => {
    if (root.hidden) return;
    removeEventListener("keydown", key); removeEventListener("resize", size); document.removeEventListener("fullscreenchange", onFull); root.onclick = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    root.hidden = true; history.replaceState(null, "", location.pathname + location.search);
    onExit(i);
  };
  const key = (e) => {
    const k = e.key;
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(k)) show(i + 1);
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(k)) show(i - 1);
    else if (k === "Home") show(0);
    else if (k === "End") show(n - 1);
    else if (/^\d$/.test(k)) { typed += k; return; }
    else if (k === "Enter" && typed) show(+typed - 1);
    else if (k === "f" || k === "F") (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())?.catch(() => {});
    else if (k === "Escape") exit();
    else return;
    typed = ""; e.preventDefault();
  };

  root.hidden = false;
  root.onclick = (e) => show(e.clientX > innerWidth / 2 ? i + 1 : i - 1);
  addEventListener("keydown", key); addEventListener("resize", size);
  root.requestFullscreen?.().then(() => document.addEventListener("fullscreenchange", onFull)).catch(() => {});
  show(i);
}
