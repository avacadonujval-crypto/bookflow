import type { BookStatus } from "@prisma/client";

/** Version bump applied when a book is published (re-publish increments). */
export function nextPublishedVersion(
  status: BookStatus,
  currentVersion: number,
): number {
  return status === "PUBLISHED" ? currentVersion + 1 : currentVersion;
}
