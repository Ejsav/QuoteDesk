import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading leads">
        <div className="flex items-end justify-between">
          <div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="mt-7 h-10 w-full" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="mt-4 space-y-px overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[62px] rounded-none" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
