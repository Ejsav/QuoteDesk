import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/page";

export default function NotFound() {
  return (
    <PageContainer width="narrow">
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg-muted">
          <SearchX className="size-5" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-fg">We couldn&apos;t find that record</h1>
        <p className="mt-2 text-sm text-fg-muted">It may have been deleted or merged into another record, or the link may be incomplete.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/leads">Leads</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/customers">Customers</Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/">Command Center</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
