"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[BookFlow] Reader error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          Couldn’t open this book
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading the reader. You can retry or go
          back to your library.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link href="/student/library">
            <Button type="button" variant="outline">
              Back to library
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
