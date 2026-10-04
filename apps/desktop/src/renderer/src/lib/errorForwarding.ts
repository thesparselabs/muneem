import type { RendererErrorInput } from '@muneem/contracts';

type Report = (input: RendererErrorInput) => Promise<unknown>;

const describe = (source: RendererErrorInput['source'], err: unknown, fallback: string): RendererErrorInput => ({
  source,
  ...(err instanceof Error ? { name: err.name.slice(0, 200), message: err.message.slice(0, 2000), ...(err.stack && { stack: err.stack.slice(0, 8000) }) }
    : { message: fallback.slice(0, 2000) }),
});

// ADR-0053: renderer errors go to main, which scrubs them and sends them only if the business opted in.
export function forwardRendererErrors(target: Pick<Window, 'addEventListener'>, report: Report): void {
  const send = (input: RendererErrorInput) => { try { void report(input).catch(() => undefined); } catch { /* the bridge is gone */ } };
  target.addEventListener('error', (e) => send(describe('error', (e as ErrorEvent).error, (e as ErrorEvent).message ?? 'error')));
  target.addEventListener('unhandledrejection', (e) => send(describe('unhandledrejection', (e as PromiseRejectionEvent).reason, 'unhandled rejection')));
}
