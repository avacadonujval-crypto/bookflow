import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const pages = [
  {
    title: "Foundations of Interactive Learning",
    lines: [
      "BookFlow Sample Book — Dr. Mira Chen",
      "",
      "Adaptive learning personalizes pacing and practice based on each",
      "learner's performance. Formative assessment gives timely feedback",
      "so instructors can intervene early.",
      "",
      "Interactive eBooks combine reading with quizzes, notes, bookmarks,",
      "highlights, and an AI tutor grounded in the book content.",
      "",
      "Use Ask this book in the AI Tutor panel while you study.",
    ],
  },
  {
    title: "Chapter 1 — Welcome to Adaptive Learning",
    lines: [
      "Learners progress through chapters at different speeds. Systems that",
      "adapt pathway or pacing help every student stay in their zone of",
      "challenge without stalling or racing ahead unsupported.",
      "",
      "Bookmarks and highlights help learners return to important locations.",
      "Analytics show completion rates and assessment scores across a class",
      "so instructors can spot at-risk learners early.",
      "",
      "Primary goal of adaptive learning: personalize pacing and practice.",
    ],
  },
  {
    title: "Chapter 2 — Practice & Feedback",
    lines: [
      "Practice questions reinforce concepts right after reading.",
      "Flashcards support spaced repetition. Quizzes check understanding",
      "before moving on to the next chapter.",
      "",
      "An AI tutor can answer questions grounded in the book while students",
      "study — Live Tutor for spoken Q&A, Study chat for typed questions,",
      "and Audio Overview for a short briefing you can replay anytime.",
      "",
      "Publishers publish versioned books, organizations license access,",
      "instructors assign, and learners read and practice. Analytics close",
      "the loop for continuous improvement.",
    ],
  },
];

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

for (const pageSpec of pages) {
  const page = doc.addPage([612, 792]);
  let y = 720;
  page.drawText(pageSpec.title, {
    x: 54,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.12),
  });
  y -= 36;
  for (const line of pageSpec.lines) {
    if (!line) {
      y -= 14;
      continue;
    }
    page.drawText(line, {
      x: 54,
      y,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.18),
      maxWidth: 504,
    });
    y -= 16;
  }
}

const bytes = await doc.save();
writeFileSync("public/sample/foundations.pdf", bytes);
console.log("Wrote public/sample/foundations.pdf", bytes.length, "bytes");
