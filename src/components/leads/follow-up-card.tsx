"use client";

import { CalendarCheck2, CalendarClock, CalendarPlus, X } from "lucide-react";
import { useState } from "react";
import { addDays, formatDayDistance, formatPlainDate, type PlainDate } from "@/domain/dates";
import { followUpPresets, followUpState, type LeadStatus } from "@/domain/lead";
import { clearFollowUpAction, completeFollowUpAction, scheduleFollowUpAction } from "@/server/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useAction } from "./use-action";

export function FollowUpCard({
  leadId,
  date,
  note,
  status,
  today,
  className,
  id,
}: {
  leadId: string;
  date: PlainDate | null;
  note: string | null;
  status: LeadStatus;
  today: PlainDate;
  className?: string;
  id?: string;
}) {
  const schedule = useAction(scheduleFollowUpAction);
  const complete = useAction(completeFollowUpAction);
  const clear = useAction(clearFollowUpAction);
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState<string>(date ?? addDays(today, 1));
  const [draftNote, setDraftNote] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const state = followUpState(date, today);
  const busy = schedule.pending || complete.pending || clear.pending;
  const presets = followUpPresets(today);

  function openEditor() {
    setDraftDate(date && date >= today ? date : addDays(today, 1));
    setDraftNote(note ?? "");
    setError(null);
    setEditing(true);
  }

  function save(targetDate: string, targetNote: string | null) {
    if (!targetDate) {
      setError("Choose a date.");
      return;
    }
    if (targetDate < today) {
      setError("Choose today or a later date.");
      return;
    }
    void schedule.run(
      { id: leadId, expectedDate: date, date: targetDate, note: targetNote?.trim() ? targetNote.trim() : null },
      {
        success: `Follow-up set for ${formatPlainDate(targetDate, "weekday")}`,
        onSuccess: () => setEditing(false),
        onError: (e) => {
          const fieldMessage = e.fieldErrors?.date?.[0];
          if (fieldMessage) {
            setError(fieldMessage);
            return true;
          }
        },
      },
    );
  }

  return (
    <Card id={id} className={cn("scroll-mt-28", className)}>
      <CardHeader
        title="Follow-up"
        icon={<CalendarClock />}
        action={
          date && !editing && status !== "lost" ? (
            <Tooltip content="Remove follow-up">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove follow-up"
                disabled={busy}
                onClick={() => clear.run({ id: leadId, expectedDate: date }, { success: "Follow-up removed" })}
              >
                <X />
              </Button>
            </Tooltip>
          ) : null
        }
      />
      <CardBody>
        {status === "lost" ? (
          <p className="text-sm text-fg-muted">This lead is closed. Reopen it by changing its status to schedule follow-ups.</p>
        ) : editing ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save(draftDate, draftNote);
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setDraftDate(p.date);
                    setError(null);
                  }}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    draftDate === p.date ? "border-primary bg-primary text-fg-on-primary" : "border-border bg-surface text-fg-secondary hover:border-border-strong",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Field label="Date" htmlFor="follow-up-date" error={error ?? undefined}>
              <Input
                type="date"
                min={today}
                value={draftDate}
                onChange={(e) => {
                  setDraftDate(e.target.value);
                  setError(null);
                }}
                {...fieldAria("follow-up-date", error ?? undefined)}
              />
            </Field>
            <Field label="What's the next step?" htmlFor="follow-up-note" optional>
              <Input
                id="follow-up-note"
                value={draftNote}
                maxLength={200}
                placeholder="e.g. Confirm final headcount"
                onChange={(e) => setDraftNote(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" loading={schedule.pending}>
                Save follow-up
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={schedule.pending}>
                Cancel
              </Button>
            </div>
          </form>
        ) : date && state.kind !== "none" ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-md font-semibold text-fg">{formatPlainDate(date, "weekday")}</p>
              {state.kind === "overdue" ? (
                <Badge tone="red" dot size="sm">
                  {state.days} {state.days === 1 ? "day" : "days"} overdue
                </Badge>
              ) : state.kind === "today" ? (
                <Badge tone="amber" dot size="sm">
                  Due today
                </Badge>
              ) : (
                <Badge tone="gray" size="sm">
                  {formatDayDistance(date, today)}
                </Badge>
              )}
            </div>
            {note ? <p className="mt-1.5 text-sm text-fg-secondary">{note}</p> : <p className="mt-1.5 text-sm text-fg-faint italic">No note</p>}
            <div className="mt-3.5 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={complete.pending}
                disabled={busy}
                onClick={() => complete.run({ id: leadId, expectedDate: date }, { success: "Follow-up marked done" })}
              >
                <CalendarCheck2 /> Mark done
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={openEditor}>
                Reschedule
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-fg-muted">No follow-up scheduled.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {presets.slice(0, 3).map((p) => (
                <Button key={p.label} variant="secondary" size="xs" disabled={busy} onClick={() => save(p.date, null)}>
                  {p.label}
                </Button>
              ))}
              <Button variant="ghost" size="xs" disabled={busy} onClick={openEditor}>
                <CalendarPlus /> Pick a date
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
