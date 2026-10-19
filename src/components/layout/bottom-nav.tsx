"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./sidebar";

function isItemActive(pathname: string, href: string) {
  const roots = ["/publisher", "/instructor", "/student", "/org"];
  if (roots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="pointer-events-auto flex max-w-full items-end gap-2">
        <nav
          aria-label="Primary"
          className="flex max-w-[min(100vw-5.5rem,42rem)] items-center gap-1 overflow-x-auto rounded-full border border-neutral-200/90 bg-white/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl"
        >
          {items.map((item) => {
            const isActive = isItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "pressable relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm transition-all duration-300",
                  isActive
                    ? "bg-black text-[#ffffff] shadow-sm [&_svg]:text-[#ffffff] [&_svg]:stroke-[#ffffff]"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-black",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-[#ffffff]" : "opacity-90",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "hidden whitespace-nowrap font-medium sm:inline",
                    isActive && "text-[#ffffff]",
                  )}
                >
                  {item.label}
                </span>
                <span className="sr-only sm:hidden">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="pressable flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200/90 bg-white/90 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-colors hover:bg-black hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
