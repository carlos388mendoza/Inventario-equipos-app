import type { LifecycleInfo } from "@/lib/equipment/lifecycle";
import { cn } from "@/lib/utils";

export function LifecycleBadge({ lifecycle }: { lifecycle: LifecycleInfo }) {
  const classes: Record<LifecycleInfo["state"], string> = {
    ok: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    warning:
      "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    expired:
      "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    unknown: "border-transparent bg-muted text-muted-foreground",
  };

  const icons: Record<LifecycleInfo["state"], string> = {
    ok: "●",
    warning: "◐",
    expired: "●",
    unknown: "○",
  };

  return (
    <span
      title={lifecycle.label}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        classes[lifecycle.state]
      )}
    >
      <span aria-hidden>{icons[lifecycle.state]}</span>
      {lifecycle.label}
    </span>
  );
}