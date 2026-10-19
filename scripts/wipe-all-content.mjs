import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Wipe all learning content — keep login users only
  await prisma.attemptAnswer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.aIGenerationRequest.deleteMany();
  await prisma.note.deleteMany();
  await prisma.highlight.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.readingProgress.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.license.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.contentBlock.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.bookVersion.deleteMany();
  await prisma.book.deleteMany();
  await prisma.class.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();

  const books = await prisma.book.count();
  const users = await prisma.user.findMany({
    select: { email: true, role: true },
  });

  console.log("Books remaining:", books);
  console.log("Users kept:", users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
