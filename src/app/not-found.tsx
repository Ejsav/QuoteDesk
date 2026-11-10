import Link from "next/link";
import { Wordmark } from "@/components/shell/logo";

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark />
      <div>
        <h1 className="text-xl font-semibold text-fg">Page not found</h1>
        <p className="mt-2 text-sm text-fg-muted">That address doesn&apos;t exist in QuoteDesk.</p>
      </div>
      <Link href="/" className="text-sm font-medium text-fg underline underline-offset-4">
        Go to the Command Center
      </Link>
    </div>
  );
}
