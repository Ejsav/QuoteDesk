import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function CustomersLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading customers">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex flex-col gap-3 lg:flex-row">
          <Skeleton className="h-8 w-full lg:max-w-sm" />
          <Skeleton className="h-8 w-80 max-w-full" />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5 last:border-b-0">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="hidden h-3.5 w-32 md:block" />
              <Skeleton className="hidden h-3.5 w-12 md:block" />
              <Skeleton className="hidden h-5 w-40 md:block" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
