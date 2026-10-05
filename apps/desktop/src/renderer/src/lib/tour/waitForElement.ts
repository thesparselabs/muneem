export function waitForElement(selector: string, timeoutMs: number, signal: AbortSignal): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (signal.aborted) return resolve(null);
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.getClientRects().length > 0) return resolve(el);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}
