import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const published = await prisma.book.findMany({
    where: { status: "PUBLISHED" },
  });

  for (const book of published) {
    const publisherMembership = await prisma.membership.findFirst({
      where: { userId: book.publisherId },
    });
    const organizationId =
      book.organizationId ?? publisherMembership?.organizationId;
    if (!organizationId) {
      console.log(`Skip ${book.title}: no organization`);
      continue;
    }

    await prisma.book.update({
      where: { id: book.id },
      data: { organizationId },
    });

    const orgLicense = await prisma.license.findFirst({
      where: {
        bookId: book.id,
        scope: "ORGANIZATION",
        organizationId,
        isActive: true,
      },
    });
    if (!orgLicense) {
      await prisma.license.create({
        data: {
          bookId: book.id,
          scope: "ORGANIZATION",
          organizationId,
          seats: 500,
          isActive: true,
        },
      });
    }

    let klass = await prisma.class.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    if (!klass) {
      const instructor =
        (await prisma.user.findFirst({
          where: {
            role: "INSTRUCTOR",
            memberships: { some: { organizationId } },
          },
        })) ?? (await prisma.user.findUnique({ where: { id: book.publisherId } }));

      klass = await prisma.class.create({
        data: {
          name: "Open Library",
          description: "Auto-created class for published BookFlow titles",
          organizationId,
          instructorId: instructor.id,
        },
      });
    }

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        memberships: { some: { organizationId } },
      },
    });

    for (const student of students) {
      await prisma.enrollment.upsert({
        where: {
          classId_userId: { classId: klass.id, userId: student.id },
        },
        create: { classId: klass.id, userId: student.id },
        update: {},
      });
    }

    const assignment = await prisma.assignment.findFirst({
      where: { classId: klass.id, bookId: book.id },
    });
    if (!assignment) {
      await prisma.assignment.create({
        data: {
          classId: klass.id,
          bookId: book.id,
          title: `Read: ${book.title}`,
          description: "Open this book in the PDF reader to get started.",
          dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          createdById: book.publisherId,
        },
      });
    }

    console.log(
      `Granted student access to "${book.title}" (${students.length} students)`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
