import {
  PrismaClient,
  Role,
  BookStatus,
  QuestionType,
  LicenseScope,
  ContentBlockType,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
  await prisma.membership.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const passwordHash = await hash("Password123!", 10);

  const publisher = await prisma.user.create({
    data: {
      email: "publisher@bookflow.local",
      name: "Priya Publisher",
      role: Role.PUBLISHER,
      passwordHash,
    },
  });
  const instructor = await prisma.user.create({
    data: {
      email: "instructor@bookflow.local",
      name: "Ian Instructor",
      role: Role.INSTRUCTOR,
      passwordHash,
    },
  });
  const student = await prisma.user.create({
    data: {
      email: "student@bookflow.local",
      name: "Sam Student",
      role: Role.STUDENT,
      passwordHash,
    },
  });
  const student2 = await prisma.user.create({
    data: {
      email: "student2@bookflow.local",
      name: "Alex Learner",
      role: Role.STUDENT,
      passwordHash,
    },
  });
  const orgAdmin = await prisma.user.create({
    data: {
      email: "admin@bookflow.local",
      name: "Olivia Admin",
      role: Role.ORG_ADMIN,
      passwordHash,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Northbridge Learning",
      slug: "northbridge",
      memberships: {
        create: [
          { userId: publisher.id, role: Role.PUBLISHER },
          { userId: instructor.id, role: Role.INSTRUCTOR },
          { userId: student.id, role: Role.STUDENT },
          { userId: student2.id, role: Role.STUDENT },
          { userId: orgAdmin.id, role: Role.ORG_ADMIN },
        ],
      },
    },
  });

  const chapterBodies = [
    {
      title: "Welcome to Adaptive Learning",
      content:
        "<p>Adaptive learning platforms personalize pacing and practice. In BookFlow, publishers enrich digital books with interactive activities so learners can read, practice, and reflect in one place.</p><p>This chapter introduces the learning loop: read, check understanding, get feedback, and continue.</p>",
    },
    {
      title: "Reading with Intention",
      content:
        "<p>Effective digital reading combines navigation, annotation, and retrieval practice. Use bookmarks for return points, highlights for evidence, and notes for your own explanations.</p><p>Progress is saved automatically so you can resume on any device.</p>",
    },
    {
      title: "Formative Assessment Basics",
      content:
        "<p>Formative assessment helps instructors see where learners struggle before high-stakes tests. Multiple-choice, multi-select, true/false, and fill-in items each measure different kinds of understanding.</p>",
    },
    {
      title: "Feedback that Teaches",
      content:
        "<p>Good feedback explains why an answer is correct or incorrect and points learners back into the text. Explanations should be specific, timely, and actionable.</p>",
    },
    {
      title: "Classroom Assignment Design",
      content:
        "<p>Instructors assign books and set deadlines so cohorts move through shared milestones. Class analytics highlight at-risk learners who have low completion or quiz scores.</p>",
    },
    {
      title: "Putting It All Together",
      content:
        "<p>Publishers publish versioned books, organizations license access, instructors assign, and learners read and practice. Analytics close the loop for continuous improvement.</p>",
    },
  ];

  const book = await prisma.book.create({
    data: {
      title: "Foundations of Interactive Learning",
      author: "Dr. Mira Chen",
      description:
        "A sample BookFlow title covering adaptive reading, formative assessment, and classroom practice.",
      subject: "Education",
      language: "en",
      status: BookStatus.PUBLISHED,
      version: 1,
      isDemo: true,
      organizationId: org.id,
      publisherId: publisher.id,
      publishedAt: new Date(),
      coverUrl: "/covers/sample-cover.svg",
      fileType: "pdf",
      fileUrl: "/sample/foundations.pdf",
      versions: {
        create: {
          version: 1,
          changelog: "Initial published sample edition",
          publishedBy: publisher.id,
        },
      },
      chapters: {
        create: chapterBodies.map((c, i) => ({
          title: c.title,
          content: c.content,
          order: i + 1,
        })),
      },
    },
    include: { chapters: { orderBy: { order: "asc" } } },
  });

  const draft = await prisma.book.create({
    data: {
      title: "Draft: Workplace Communication",
      author: "Jordan Ellis",
      description: "Unpublished draft used to demonstrate publisher workflows.",
      subject: "Business",
      language: "en",
      status: BookStatus.DRAFT,
      version: 1,
      organizationId: org.id,
      publisherId: publisher.id,
      chapters: {
        create: [
          {
            title: "Tone and Clarity",
            order: 1,
            content: "<p>Draft chapter content.</p>",
          },
        ],
      },
    },
  });

  const ch1 = book.chapters[0];
  const ch3 = book.chapters[2];

  await prisma.contentBlock.createMany({
    data: [
      {
        chapterId: ch1.id,
        type: ContentBlockType.GLOSSARY,
        order: 1,
        title: "Adaptive learning",
        body: "Instruction that adjusts pathway or pacing based on learner performance.",
      },
      {
        chapterId: ch1.id,
        type: ContentBlockType.EXTERNAL_LINK,
        order: 2,
        title: "Further reading",
        body: "https://example.com/learning-science",
        metadata: { label: "Learning science overview" },
      },
      {
        chapterId: ch1.id,
        type: ContentBlockType.VIDEO,
        order: 3,
        title: "Intro clip",
        body: "https://www.w3schools.com/html/mov_bbb.mp4",
      },
    ],
  });

  const mcq = await prisma.question.create({
    data: {
      chapterId: ch1.id,
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "What is the primary goal of adaptive learning?",
      explanation: "Adaptive systems personalize pacing and practice.",
      feedback: "Revisit the definition in the opening section.",
      points: 2,
      order: 1,
      options: {
        create: [
          { label: "Personalize pacing and practice", isCorrect: true, order: 1 },
          { label: "Replace teachers entirely", isCorrect: false, order: 2 },
          { label: "Remove all assessments", isCorrect: false, order: 3 },
          { label: "Publish books faster", isCorrect: false, order: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      chapterId: ch1.id,
      type: QuestionType.TRUE_FALSE,
      prompt: "Bookmarks help learners return to important locations.",
      explanation: "Bookmarks are navigation aids for return points.",
      points: 1,
      order: 2,
      options: {
        create: [
          { label: "True", isCorrect: true, order: 1 },
          { label: "False", isCorrect: false, order: 2 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      chapterId: ch3.id,
      type: QuestionType.MULTIPLE_ANSWER,
      prompt: "Which item types can measure understanding? (Select all that apply)",
      explanation: "Several objective formats support formative checks.",
      points: 3,
      order: 1,
      options: {
        create: [
          { label: "Multiple-choice", isCorrect: true, order: 1 },
          { label: "True/false", isCorrect: true, order: 2 },
          { label: "Fill-in-the-blank", isCorrect: true, order: 3 },
          { label: "Random wallpaper colors", isCorrect: false, order: 4 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      chapterId: ch3.id,
      type: QuestionType.FILL_BLANK,
      prompt: "Formative assessment helps instructors see where learners ______.",
      correctText: "struggle",
      explanation: "The chapter emphasizes identifying struggle early.",
      points: 2,
      order: 2,
    },
  });

  await prisma.question.create({
    data: {
      chapterId: book.chapters[3].id,
      type: QuestionType.MATCHING,
      prompt: "Match each term to its description.",
      matchingJson: {
        Feedback: "Explains correctness and next steps",
        Annotation: "Highlight or note in the text",
        License: "Controls who can open a book",
      },
      points: 3,
      order: 1,
    },
  });

  await prisma.question.create({
    data: {
      chapterId: book.chapters[1].id,
      type: QuestionType.REFLECTION,
      prompt: "Describe one annotation habit you will try while reading digitally.",
      explanation: "Reflection prompts build metacognition.",
      points: 2,
      order: 1,
    },
  });

  const klass = await prisma.class.create({
    data: {
      name: "EDU 210 — Digital Pedagogy",
      description: "Sample instructor cohort using the Foundations book.",
      organizationId: org.id,
      instructorId: instructor.id,
      enrollments: {
        create: [{ userId: student.id }, { userId: student2.id }],
      },
    },
  });

  await prisma.assignment.create({
    data: {
      classId: klass.id,
      bookId: book.id,
      title: "Complete Chapters 1–3 + quiz",
      description: "Read the first three chapters and submit the chapter activities.",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: instructor.id,
    },
  });

  await prisma.license.createMany({
    data: [
      {
        bookId: book.id,
        scope: LicenseScope.ORGANIZATION,
        organizationId: org.id,
        seats: 200,
        seatsUsed: 2,
        isActive: true,
      },
      {
        bookId: book.id,
        scope: LicenseScope.CLASS,
        classId: klass.id,
        seats: 40,
        seatsUsed: 2,
        isActive: true,
      },
      {
        bookId: draft.id,
        scope: LicenseScope.USER,
        userId: publisher.id,
        seats: 1,
        seatsUsed: 1,
        isActive: true,
      },
    ],
  });

  await prisma.readingProgress.createMany({
    data: [
      {
        userId: student.id,
        bookId: book.id,
        chapterId: book.chapters[1].id,
        percentComplete: 42,
        lastLocation: book.chapters[1].id,
        readingTimeSec: 1800,
      },
      {
        userId: student2.id,
        bookId: book.id,
        chapterId: book.chapters[0].id,
        percentComplete: 12,
        lastLocation: book.chapters[0].id,
        readingTimeSec: 420,
      },
    ],
  });

  await prisma.bookmark.create({
    data: {
      userId: student.id,
      bookId: book.id,
      chapterId: ch1.id,
      label: "Definition of adaptive learning",
      location: "paragraph-1",
    },
  });

  await prisma.highlight.create({
    data: {
      userId: student.id,
      bookId: book.id,
      chapterId: ch1.id,
      text: "personalize pacing and practice",
      color: "yellow",
      startOffset: 10,
      endOffset: 40,
    },
  });

  await prisma.note.create({
    data: {
      userId: student.id,
      bookId: book.id,
      chapterId: ch1.id,
      body: "Connect this to classroom differentiation strategies.",
    },
  });

  const attempt = await prisma.attempt.create({
    data: {
      userId: student.id,
      bookId: book.id,
      chapterId: ch1.id,
      score: 2,
      maxScore: 3,
      completed: true,
      answers: {
        create: [
          {
            questionId: mcq.id,
            answerJson: { type: "MULTIPLE_CHOICE", optionId: "seed" },
            isCorrect: true,
            pointsEarned: 2,
          },
        ],
      },
    },
  });

  void attempt;

  const now = Date.now();
  await prisma.analyticsEvent.createMany({
    data: [
      {
        type: "book_open",
        userId: student.id,
        bookId: book.id,
        metadata: { source: "seed" },
        createdAt: new Date(now - 86400000 * 3),
      },
      {
        type: "book_open",
        userId: student2.id,
        bookId: book.id,
        metadata: { source: "seed" },
        createdAt: new Date(now - 86400000 * 2),
      },
      {
        type: "chapter_complete",
        userId: student.id,
        bookId: book.id,
        metadata: { chapterTitle: ch1.title, chapterId: ch1.id },
        createdAt: new Date(now - 86400000),
      },
      {
        type: "quiz_submit",
        userId: student.id,
        bookId: book.id,
        metadata: { score: 2, maxScore: 3 },
        createdAt: new Date(now - 86000000),
      },
      {
        type: "search",
        userId: student.id,
        bookId: book.id,
        metadata: { query: "feedback" },
      },
      {
        type: "search",
        userId: student2.id,
        bookId: book.id,
        metadata: { query: "adaptive" },
      },
      {
        type: "highlight",
        userId: student.id,
        bookId: book.id,
        metadata: { text: "personalize pacing and practice" },
      },
    ],
  });

  await prisma.aIGenerationRequest.create({
    data: {
      type: "CHAPTER_SUMMARY",
      status: "COMPLETED",
      bookId: book.id,
      chapterId: ch1.id,
      userId: publisher.id,
      prompt: "Summarize chapter 1",
      result:
        "AI-generated summary (requires review): Chapter 1 introduces adaptive learning and the read–practice–feedback loop.",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: publisher.id,
      action: "book.publish",
      entityType: "Book",
      entityId: book.id,
      metadata: { version: 1 },
    },
  });

  console.log("Seeded BookFlow demo data.");
  console.log("Users:");
  console.log("  publisher@bookflow.local / Password123!");
  console.log("  instructor@bookflow.local / Password123!");
  console.log("  student@bookflow.local / Password123!");
  console.log("  admin@bookflow.local / Password123!");
  console.log(`Sample book: ${book.title} (${book.id})`);
  console.log(`Draft book: ${draft.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
