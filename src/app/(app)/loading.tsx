import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="mt-3 h-7 w-72" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[118px] rounded-xl" />
          ))}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-12">
          <Skeleton className="h-96 rounded-xl xl:col-span-7" />
          <Skeleton className="h-96 rounded-xl xl:col-span-5" />
        </div>
      </div>
    </PageContainer>
  );
}
