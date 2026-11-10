"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Free-text tag entry. Enter or comma adds, Backspace on an empty field removes
 * the last tag, pasting "A, B, C" adds three, and leaving the field keeps
 * whatever was typed. Tags are deduplicated case-insensitively.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  maxTags = 30,
  maxLength = 60,
  invalid,
  describedBy,
  onBlur,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim().slice(0, maxLength))
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const part of parts) {
      if (next.length >= maxTags) break;
      if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 shadow-xs transition-[border-color,box-shadow] duration-150 sm:min-h-8",
        "hover:border-border-strong focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        invalid && "border-danger focus-within:ring-danger/20",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus();
      }}
    >
      {value.map((tag, i) => (
        <span key={`${tag}-${i}`} className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-surface-hover pr-0.5 pl-2 text-xs font-medium text-fg">
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`Remove ${tag}`}
            className="flex size-5 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-active hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) {
            add(v);
            setDraft("");
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
            setDraft("");
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            e.preventDefault();
            remove(value.length - 1);
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.includes(",") || text.includes("\n")) {
            e.preventDefault();
            add(text.replace(/\n/g, ","));
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            add(draft);
            setDraft("");
          }
          onBlur?.();
        }}
        maxLength={maxLength}
        placeholder={value.length === 0 ? placeholder : value.length >= maxTags ? "" : "Add another…"}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={value.length >= maxTags}
        className="h-6 min-w-[8rem] flex-1 bg-transparent px-1 text-base text-fg outline-none placeholder:text-fg-faint sm:text-sm"
      />
    </div>
  );
}
