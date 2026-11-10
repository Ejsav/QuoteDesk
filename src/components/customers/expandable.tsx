"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shows a server-rendered preview with a toggle to the full server-rendered
 * list — keeps long histories from burying the rest of the page on phones.
 */
export function Expandable({
  preview,
  full,
  total,
  noun = "entries",
}: {
  preview: React.ReactNode;
  full: React.ReactNode;
  total: number;
  noun?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      {expanded ? full : preview}
      <div className="mt-4 border-t border-border-subtle pt-3">
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? (
            <>
              <ChevronUp /> Show fewer
            </>
          ) : (
            <>
              <ChevronDown /> Show all {total} {noun}
            </>
          )}
        </Button>
      </div>
    </>
  );
}
