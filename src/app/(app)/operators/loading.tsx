import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function OperatorsLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading operators">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-[28rem] max-w-[80vw]" />
          </div>
          <Skeleton className="hidden h-8 w-32 sm:block" />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Skeleton className="h-9 rounded-none" />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-border-subtle px-5 py-4">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="hidden h-6 w-40 md:block" />
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
