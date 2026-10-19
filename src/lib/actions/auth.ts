"use server";

import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ROLE_HOME } from "@/lib/auth-helpers";
import { slugify } from "@/lib/utils";

export type AuthActionState = {
  ok: boolean;
  message?: string;
};

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
  role: z.enum(["STUDENT", "INSTRUCTOR", "PUBLISHER", "ORG_ADMIN"]),
});

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

const resetSchema = z.object({
  token: z.string().min(1, "Reset token is missing"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  callbackUrl: z.string().optional(),
});

export async function loginUser(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid credentials",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const fallbackHome = user ? ROLE_HOME[user.role] : "/student";
  const callbackUrl =
    parsed.data.callbackUrl && parsed.data.callbackUrl !== "/"
      ? parsed.data.callbackUrl
      : fallbackHome;

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, message: "Invalid email or password." };
    }
    // Next.js redirect throws; rethrow so navigation proceeds
    throw error;
  }
}

export async function registerUser(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid registration data",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, message: "An account with this email already exists" };
  }

  const passwordHash = await hash(parsed.data.password, 10);
  const role = parsed.data.role as Role;

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      role,
    },
  });

  if (role === "ORG_ADMIN") {
    const baseSlug = slugify(parsed.data.name) || "organization";
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    await prisma.organization.create({
      data: {
        name: `${parsed.data.name}'s Organization`,
        slug,
        memberships: {
          create: {
            userId: user.id,
            role: "ORG_ADMIN",
          },
        },
      },
    });
  }

  await writeAuditLog({
    userId: user.id,
    action: "user.register",
    entityType: "User",
    entityId: user.id,
    metadata: { role },
  });

  return {
    ok: true,
    message: "Account created. You can sign in now.",
  };
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid email",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[BookFlow] Password reset link: /reset-password?token=${token}`,
      );
    }

    await writeAuditLog({
      userId: user.id,
      action: "user.password_reset_requested",
      entityType: "User",
      entityId: user.id,
    });
  }

  return {
    ok: true,
    message:
      "If an account exists for that email, password reset instructions have been sent.",
  };
}

export async function resetPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid reset request",
    };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return {
      ok: false,
      message: "This reset link is invalid or has expired.",
    };
  }

  const passwordHash = await hash(parsed.data.password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId: record.userId,
    action: "user.password_reset_completed",
    entityType: "User",
    entityId: record.userId,
  });

  return {
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  };
}
