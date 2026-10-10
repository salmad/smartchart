/* A link on a slide to another slide of the deck: [words](#s_id) draws an <a data-slide>. Each place that shows
   slides (the editor, the presentation, a shared deck) goes to that slide instead of following the address. */
export const slideLinkOf = (target: EventTarget | null): string | null =>
  target instanceof Element ? target.closest('a[data-slide]')?.getAttribute('data-slide') ?? null : null
