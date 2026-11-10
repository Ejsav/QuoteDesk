"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CopyCommand({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-border bg-surface-sunken py-1.5 pr-1.5 pl-3 font-mono text-sm", className)}>
      <span aria-hidden className="text-fg-faint select-none">$</span>
      <code className="min-w-0 flex-1 truncate text-fg">{command}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            // Clipboard unavailable — the command is still visible to copy by hand.
          }
        }}
        className="flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        aria-label={copied ? "Copied" : `Copy ${command}`}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
