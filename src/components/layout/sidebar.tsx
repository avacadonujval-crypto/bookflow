"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function Sidebar({
  title,
  items,
  footer,
}: {
  title: string;
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-6">
        <Link href="/" className="block group">
          <div className="text-[13px] font-semibold tracking-[-0.02em] text-foreground transition-opacity group-hover:opacity-70">
            BookFlow
          </div>
          <div className="mt-1 text-xs font-light text-muted-foreground">
            {title}
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-3" aria-label="Main">
        {items.map((item, index) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "pressable animate-slide-in flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                `stagger-${Math.min(index + 1, 5)}`,
                active
                  ? "bg-black text-white"
                  : "font-light text-neutral-600 hover:bg-neutral-100 hover:text-black",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {footer ? (
        <div className="border-t border-neutral-100 p-4">{footer}</div>
      ) : null}
    </aside>
  );
}
