"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Centered fade/scale page enter for authenticated dashboards.
 * Bottom nav lives outside this wrapper and stays persistent.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      key={pathname}
      className={cn(
        "page-transition-root w-full min-h-0",
        !reduced && "page-transition-enter",
      )}
    >
      {children}
    </div>
  );
}
