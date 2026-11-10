import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function OperatorLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading operator">
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="mb-6 flex items-start gap-4">
          <Skeleton className="hidden size-12 rounded-lg sm:block" />
          <div className="flex-1">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          </div>
        </div>
        <Skeleton className="mb-5 h-[86px] rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="order-2 space-y-5 xl:order-1 xl:col-span-8">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="order-1 space-y-5 xl:order-2 xl:col-span-4">
            <Skeleton className="h-60 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
