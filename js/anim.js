export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Animate an element's text from its current value to `to`. */
export function countTo(el, to, { format = (n) => Math.round(n).toLocaleString('en-IN'), duration = 900 } = {}) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (reducedMotion() || document.hidden || from === to) { el.textContent = format(to); return; }
  const start = performance.now();
  cancelAnimationFrame(el._raf);
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(from + (to - from) * easeOut(t));
    if (t < 1) el._raf = requestAnimationFrame(tick);
  };
  el._raf = requestAnimationFrame(tick);
}
