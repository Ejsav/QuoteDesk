import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading lead">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-7 w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <div className="mt-7 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Skeleton className="h-[380px] rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
