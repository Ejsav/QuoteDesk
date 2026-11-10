/**
 * A chronological event queue. Every seed action is scheduled at a simulated
 * moment, then replayed in time order through the real services — so the
 * workspace activity feed, derived timestamps and metrics come out exactly as
 * if a person had done the work in the app.
 */
import { ServiceError, ValidationError } from "../../services/errors";

interface SeedEvent {
  at: number;
  seq: number;
  label: string;
  run: () => Promise<unknown>;
}

export class Timeline {
  private readonly events: SeedEvent[] = [];
  private seq = 0;

  /** @param latest no event may be later than this (epoch ms) — keeps everything in the past. */
  constructor(private readonly latest: number) {}

  add(at: Date, label: string, run: () => Promise<unknown>): void {
    if (Number.isNaN(at.getTime())) throw new Error(`Seed event "${label}" has an invalid timestamp.`);
    this.events.push({ at: Math.min(at.getTime(), this.latest), seq: this.seq++, label, run });
  }

  get size(): number {
    return this.events.length;
  }

  /** Replays events oldest-first; ties keep scheduling order. */
  async replay(setNow: (moment: Date) => void): Promise<number> {
    const ordered = [...this.events].sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const event of ordered) {
      const moment = new Date(event.at);
      setNow(moment);
      try {
        await event.run();
      } catch (error) {
        throw new Error(`Seed event failed — ${event.label} (at ${moment.toISOString()}): ${describe(error)}`, { cause: error });
      }
    }
    return ordered.length;
  }
}

function describe(error: unknown): string {
  if (error instanceof ValidationError) return `${error.message} ${JSON.stringify(error.fieldErrors)}`;
  if (error instanceof ServiceError) return `${error.code}: ${error.message}`;
  if (error && typeof error === "object" && "issues" in error) return JSON.stringify((error as { issues: unknown }).issues);
  return error instanceof Error ? error.message : String(error);
}
