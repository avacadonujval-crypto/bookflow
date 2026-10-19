import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  {
    title: "Publishers",
    description: "Craft titles, ship versions, and understand how readers engage.",
  },
  {
    title: "Instructors",
    description: "Assign learning, guide classes, and see who needs support.",
  },
  {
    title: "Students",
    description: "Read with focus, practice with AI, and track your progress.",
  },
  {
    title: "Organizations",
    description: "License content, manage people, and keep learning connected.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white surface-grain">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.05),transparent_55%)]" />

      <header className="relative z-10 border-b border-neutral-200/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="animate-fade-in">
            <span className="text-[17px] font-semibold tracking-[-0.03em]">
              BookFlow
            </span>
          </Link>
          <nav className="animate-fade-in stagger-1 flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="animate-fade-up type-small mb-5 font-medium uppercase tracking-[0.18em] text-muted-foreground">
              BookFlow
            </p>
            <h1 className="animate-fade-up stagger-1 page-title">
              Learning, distilled to its essentials.
            </h1>
            <p className="animate-fade-up stagger-2 type-medium mx-auto mt-4 max-w-2xl text-muted-foreground">
              A calm space to publish interactive books, assign them with
              clarity, and help every learner understand more — with AI that
              stays grounded in the page.
            </p>
            <div className="animate-fade-up stagger-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="min-w-[180px]">
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="min-w-[180px]">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-neutral-200 bg-neutral-50/70">
          <div className="mx-auto grid max-w-6xl gap-px bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            {roles.map((role, index) => (
              <div
                key={role.title}
                className={`animate-fade-up hover-lift bg-white px-6 py-8 stagger-${index + 1}`}
              >
                <h2 className="page-title">
                  {role.title}
                </h2>
                <p className="type-small mt-3 font-light leading-relaxed">
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="animate-scale-in mx-auto max-w-2xl text-center">
            <h2 className="page-title">
              Quiet tools. Serious outcomes.
            </h2>
            <p className="type-small mt-3">
              No visual noise. Just typography, space, and the work that
              matters — reading, teaching, and publishing with intention.
            </p>
            <div className="mt-8">
              <Link href="/register">
                <Button size="lg">Start with BookFlow</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <span className="font-medium text-foreground">BookFlow</span>
          <span className="font-light">© 2026 · Designed for clarity</span>
        </div>
      </footer>
    </div>
  );
}
