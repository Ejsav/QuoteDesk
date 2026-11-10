import { PageContainer } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/misc";

export default function CustomerProfileLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Loading customer">
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-5 lg:col-span-4">
            <Skeleton className="h-60 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
