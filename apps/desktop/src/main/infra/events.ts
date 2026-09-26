import type { PushEventName, PushEvents } from '../../shared/events.js';

export interface EventSink { send(channel: string, payload: unknown): void }

/** Fan-out from main to every renderer window. Tests attach a recording sink. */
export class EventBus {
  private sinks = new Set<EventSink>();
  attach(sink: EventSink): () => void { this.sinks.add(sink); return () => this.sinks.delete(sink); }
  emit<K extends PushEventName>(channel: K, payload: PushEvents[K]): void {
    for (const s of this.sinks) { try { s.send(channel, payload); } catch { /* window gone */ } }
  }
}
