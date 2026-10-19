"use client";

import { BottomNav } from "./bottom-nav";
import { PageTransition } from "./page-transition";
import type { NavItem } from "./sidebar";

export function AppShell({
  items,
  children,
}: {
  title?: string;
  items: NavItem[];
  userName?: string;
  userRole?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-neutral-100/90 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-3.5 md:px-8">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            BookFlow
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pt-8">
        <PageTransition>{children}</PageTransition>
      </main>

      <BottomNav items={items} />
    </div>
  );
}
