"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export type InstructorActionState = {
  ok: boolean;
  message?: string;
  data?: unknown;
};

async function requireInstructorClass(classId: string) {
  const user = await requireRole("INSTRUCTOR");
  const klass = await prisma.class.findFirst({
    where: { id: classId, instructorId: user.id },
  });
  if (!klass) return null;
  return { user, klass };
}

async function instructorOrgId(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, role: "INSTRUCTOR" },
  });
  return membership?.organizationId ?? null;
}

const createClassSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional(),
});

export async function createClass(
  _prev: InstructorActionState,
  formData: FormData,
): Promise<InstructorActionState> {
  const parsed = createClassSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid class data",
    };
  }

  const user = await requireRole("INSTRUCTOR");
  const organizationId = await instructorOrgId(user.id);
  if (!organizationId) {
    return {
      ok: false,
      message: "Your account is not linked to an organization.",
    };
  }

  const klass = await prisma.class.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      organizationId,
      instructorId: user.id,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "class.create",
    entityType: "Class",
    entityId: klass.id,
  });

  revalidatePath("/instructor/classes");
  return { ok: true, message: "Class created.", data: { id: klass.id } };
}

const enrollSchema = z.object({
  classId: z.string().min(1),
  email: z.string().trim().email(),
});

export async function enrollStudentByEmail(
  _prev: InstructorActionState,
  formData: FormData,
): Promise<InstructorActionState> {
  const parsed = enrollSchema.safeParse({
    classId: formData.get("classId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid enrollment data",
    };
  }

  const ctx = await requireInstructorClass(parsed.data.classId);
  if (!ctx) return { ok: false, message: "Class not found" };

  const student = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!student || student.role !== "STUDENT") {
    return { ok: false, message: "No student account found for that email." };
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      classId_userId: { classId: parsed.data.classId, userId: student.id },
    },
  });
  if (existing) {
    return { ok: false, message: "Student is already enrolled." };
  }

  await prisma.enrollment.create({
    data: { classId: parsed.data.classId, userId: student.id },
  });

  await writeAuditLog({
    userId: ctx.user.id,
    action: "enrollment.create",
    entityType: "Enrollment",
    metadata: { classId: parsed.data.classId, studentId: student.id },
  });

  revalidatePath(`/instructor/classes/${parsed.data.classId}`);
  return { ok: true, message: `${student.name} enrolled.` };
}

const assignBookSchema = z.object({
  classId: z.string().min(1),
  bookId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(500).optional(),
  dueAt: z.string().optional(),
});

export async function assignBookToClass(
  _prev: InstructorActionState,
  formData: FormData,
): Promise<InstructorActionState> {
  const parsed = assignBookSchema.safeParse({
    classId: formData.get("classId"),
    bookId: formData.get("bookId"),
    title: formData.get("title"),
    description: formData.get("description") || "",
    dueAt: formData.get("dueAt") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assignment data",
    };
  }

  const ctx = await requireInstructorClass(parsed.data.classId);
  if (!ctx) return { ok: false, message: "Class not found" };

  const book = await prisma.book.findFirst({
    where: {
      id: parsed.data.bookId,
      status: "PUBLISHED",
      OR: [
        { organizationId: ctx.klass.organizationId },
        { isDemo: true },
      ],
    },
  });
  if (!book) return { ok: false, message: "Book not available for assignment." };

  let dueAt: Date | null = null;
  if (parsed.data.dueAt) {
    const d = new Date(parsed.data.dueAt);
    if (!Number.isNaN(d.getTime())) dueAt = d;
  }

  const assignment = await prisma.assignment.create({
    data: {
      classId: parsed.data.classId,
      bookId: parsed.data.bookId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      dueAt,
      createdById: ctx.user.id,
    },
  });

  await writeAuditLog({
    userId: ctx.user.id,
    action: "assignment.create",
    entityType: "Assignment",
    entityId: assignment.id,
  });

  revalidatePath(`/instructor/classes/${parsed.data.classId}`);
  return { ok: true, message: "Book assigned to class." };
}
