import { Badge } from "@/components/ui/badge";
import type { BookStatus } from "@prisma/client";

export function BookStatusBadge({ status }: { status: BookStatus }) {
  const className =
    status === "PUBLISHED"
      ? "bg-black text-white"
      : status === "DRAFT"
        ? "bg-neutral-100 text-foreground"
        : "bg-neutral-100 text-muted-foreground";

  return (
    <Badge className={className}>{status.toLowerCase().replace("_", " ")}</Badge>
  );
}
