"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function DashNav({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overscroll-contain lg:pb-4">
      {items.map((i) => {
        const active = i.href === "/dashboard" ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-sm transition-colors",
              active ? "bg-white/15 font-semibold text-white" : "text-on-brand/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
