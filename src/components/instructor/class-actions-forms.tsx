"use client";

import { useActionState } from "react";
import {
  assignBookToClass,
  enrollStudentByEmail,
  type InstructorActionState,
} from "@/lib/actions/instructor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: InstructorActionState = { ok: false };

export function EnrollStudentForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState(enrollStudentByEmail, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="classId" value={classId} />
      <div className="space-y-2">
        <Label htmlFor="enroll-email">Student email</Label>
        <Input
          id="enroll-email"
          name="email"
          type="email"
          required
          placeholder="student@bookflow.local"
        />
      </div>
      {state.message ? (
        <p className={state.ok ? "text-sm text-foreground" : "text-sm text-foreground"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        Enroll student
      </Button>
    </form>
  );
}

export function AssignBookForm({
  classId,
  books,
}: {
  classId: string;
  books: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(assignBookToClass, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="classId" value={classId} />
      <div className="space-y-2">
        <Label htmlFor="bookId">Book</Label>
        <select
          id="bookId"
          name="bookId"
          required
          className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
        >
          <option value="">Select a book…</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Assignment title</Label>
        <Input id="title" name="title" required placeholder="Read chapters 1–3" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueAt">Due date</Label>
        <Input id="dueAt" name="dueAt" type="datetime-local" />
      </div>
      {state.message ? (
        <p className={state.ok ? "text-sm text-foreground" : "text-sm text-foreground"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending || books.length === 0}>
        Assign book
      </Button>
    </form>
  );
}
