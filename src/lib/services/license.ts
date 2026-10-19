import { prisma } from "@/lib/db";

export function canAccessBook(params: {
  isDemo: boolean;
  isPublisher: boolean;
  hasLicense: boolean;
}) {
  if (params.isDemo) return { allowed: true, reason: "demo" as const };
  if (params.isPublisher) return { allowed: true, reason: "publisher" as const };
  if (params.hasLicense) return { allowed: true, reason: "license" as const };
  return { allowed: false, reason: "no_license" as const };
}

export async function userHasBookAccess(userId: string, bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return { allowed: false, reason: "Book not found" as const };
  if (book.isDemo) {
    return canAccessBook({ isDemo: true, isPublisher: false, hasLicense: false });
  }
  if (book.publisherId === userId) {
    return canAccessBook({ isDemo: false, isPublisher: true, hasLicense: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: true,
      enrollments: true,
      licenses: { where: { bookId, isActive: true } },
    },
  });
  if (!user) return { allowed: false, reason: "User not found" as const };

  const now = new Date();
  const direct = user.licenses.find(
    (l) => (!l.endsAt || l.endsAt > now) && l.isActive,
  );
  if (direct) {
    return canAccessBook({ isDemo: false, isPublisher: false, hasLicense: true });
  }

  const orgIds = user.memberships.map((m) => m.organizationId);
  const classIds = user.enrollments.map((e) => e.classId);

  const scoped = await prisma.license.findFirst({
    where: {
      bookId,
      isActive: true,
      OR: [
        { scope: "ORGANIZATION", organizationId: { in: orgIds } },
        { scope: "CLASS", classId: { in: classIds } },
        { scope: "USER", userId },
      ],
      AND: [
        {
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      ],
    },
  });

  if (scoped) {
    return canAccessBook({ isDemo: false, isPublisher: false, hasLicense: true });
  }
  return canAccessBook({ isDemo: false, isPublisher: false, hasLicense: false });
}
