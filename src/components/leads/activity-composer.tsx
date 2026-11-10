"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import {
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABELS,
  type ContactChannel,
  type ContactDirection,
} from "@/domain/customer";
import type { LeadStatus } from "@/domain/lead";
import { addLeadNoteAction, logLeadContactAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useAction } from "./use-action";

export function ActivityComposer({ leadId, status, id }: { leadId: string; status: LeadStatus; id?: string }) {
  const [mode, setMode] = useState<"note" | "contact">("note");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<ContactChannel>("call");
  const [direction, setDirection] = useState<ContactDirection>("outbound");
  const [error, setError] = useState<string | null>(null);
  const note = useAction(addLeadNoteAction);
  const contact = useAction(logLeadContactAction);
  const pending = note.pending || contact.pending;

  function submit() {
    setError(null);
    if (mode === "note") {
      if (!body.trim()) {
        setError("Write something before saving the note.");
        return;
      }
      void note.run({ leadId, body }, { success: "Note added", onSuccess: () => setBody("") });
      return;
    }
    void contact.run(
      { leadId, channel, direction: channel === "meeting" ? "outbound" : direction, summary: body.trim() || null },
      {
        success: (data) =>
          `${CONTACT_CHANNEL_LABELS[channel]} logged${data.statusChanged ? " · lead moved to Contacted" : ""}`,
        onSuccess: () => setBody(""),
      },
    );
  }

  return (
    <form
      id={id}
      className="scroll-mt-28 rounded-xl border border-border bg-surface-sunken/60 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          ariaLabel="Entry type"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setError(null);
          }}
          options={[
            { value: "note", label: "Add note" },
            { value: "contact", label: "Log contact" },
          ]}
        />
        {mode === "contact" ? (
          <div className="flex flex-wrap gap-2">
            <Segmented
              size="sm"
              ariaLabel="Channel"
              value={channel}
              onChange={setChannel}
              options={CONTACT_CHANNELS.map((c) => ({ value: c, label: CONTACT_CHANNEL_LABELS[c] }))}
            />
            {channel !== "meeting" ? (
              <Segmented
                size="sm"
                ariaLabel="Direction"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: "outbound", label: "We reached out" },
                  { value: "inbound", label: "They reached out" },
                ]}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <label htmlFor={`${id ?? "composer"}-body`} className="sr-only">
        {mode === "note" ? "Note" : "Summary"}
      </label>
      <Textarea
        id={`${id ?? "composer"}-body`}
        value={body}
        maxLength={mode === "note" ? 5000 : 2000}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        aria-invalid={error ? true : undefined}
        placeholder={
          mode === "note"
            ? "Add an internal note — requirements, preferences, context for the team…"
            : "What happened? e.g. Confirmed 18 guests, wants a Sprinter with luggage space"
        }
        className="mt-2.5 min-h-[76px] bg-surface"
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-start gap-1.5 text-xs text-fg-muted">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {mode === "note"
            ? "Visible to your team only."
            : status === "new"
              ? "Records contact that happened outside QuoteDesk — nothing is sent. Logging contact moves this New lead to Contacted."
              : "Records contact that happened outside QuoteDesk — nothing is sent."}
        </p>
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          {mode === "note" ? "Save note" : `Log ${CONTACT_CHANNEL_LABELS[channel].toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
