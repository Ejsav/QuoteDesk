import { cn } from "@/lib/utils";

/** QuoteDesk mark: a "Q" whose tail runs out like a route line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-[#1c2740] dark:fill-[#1b2029]" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" className="stroke-transparent dark:stroke-[#2c323d]" />
      <circle cx="14.75" cy="14.75" r="6.75" strokeWidth="2.6" className="stroke-white dark:stroke-[#ebecee]" />
      <path d="M19.4 19.4 24.2 24.2" stroke="#d4b97e" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-fg">QuoteDesk</span>
        <span className="rounded-[4px] border border-accent-line/70 px-1 text-[9.5px] leading-[14px] font-semibold tracking-[0.08em] text-accent-strong">
          OS
        </span>
      </span>
    </span>
  );
}
