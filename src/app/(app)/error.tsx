"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/page";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageContainer width="narrow">
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg-muted">
          <TriangleAlert className="size-5" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-fg">This page couldn&apos;t load</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Something went wrong while loading data. Your records weren&apos;t changed. Try again, or head back to the Command Center.
        </p>
        {digest ? <p className="mt-3 font-mono text-xs text-fg-faint">Reference: {digest}</p> : null}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => retry()}>
            <RotateCcw /> Try again
          </Button>
          <Button asChild variant="primary">
            <Link href="/">Command Center</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
