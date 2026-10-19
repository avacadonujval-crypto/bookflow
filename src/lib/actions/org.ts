"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export type OrgActionState = {
  ok: boolean;
  message?: string;
  data?: unknown;
};

async function requireOrgAdminContext() {
  const user = await requireRole("ORG_ADMIN");
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, role: "ORG_ADMIN" },
    include: { organization: true },
  });
  if (!membership) return null;
  return { user, organization: membership.organization, membership };
}

const inviteUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(120),
  role: z.enum(["STUDENT", "INSTRUCTOR", "PUBLISHER", "ORG_ADMIN"]),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
});

export async function inviteOrAddUser(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user data",
    };
  }

  const ctx = await requireOrgAdminContext();
  if (!ctx) {
    return { ok: false, message: "No organization linked to your account." };
  }

  const email = parsed.data.email.toLowerCase();
  let targetUser = await prisma.user.findUnique({ where: { email } });

  if (targetUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUser.id,
          organizationId: ctx.organization.id,
        },
      },
    });
    if (existingMembership) {
      return { ok: false, message: "User is already a member of this organization." };
    }

    await prisma.membership.create({
      data: {
        userId: targetUser.id,
        organizationId: ctx.organization.id,
        role: parsed.data.role as Role,
      },
    });
  } else {
    const passwordHash = await hash(parsed.data.password, 10);
    targetUser = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role as Role,
        memberships: {
          create: {
            organizationId: ctx.organization.id,
            role: parsed.data.role as Role,
          },
        },
      },
    });
  }

  await writeAuditLog({
    userId: ctx.user.id,
    action: "org.user_add",
    entityType: "User",
    entityId: targetUser.id,
    metadata: { organizationId: ctx.organization.id, role: parsed.data.role },
  });

  revalidatePath("/org/users");
  return { ok: true, message: `${parsed.data.name} added to ${ctx.organization.name}.` };
}

const licenseUpdateSchema = z.object({
  licenseId: z.string().min(1),
  seats: z.coerce.number().int().min(1).max(100000),
  isActive: z.coerce.boolean().optional(),
});

export async function updateOrganizationLicense(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const parsed = licenseUpdateSchema.safeParse({
    licenseId: formData.get("licenseId"),
    seats: formData.get("seats"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid license data",
    };
  }

  const ctx = await requireOrgAdminContext();
  if (!ctx) {
    return { ok: false, message: "No organization linked to your account." };
  }

  const license = await prisma.license.findFirst({
    where: {
      id: parsed.data.licenseId,
      organizationId: ctx.organization.id,
      scope: "ORGANIZATION",
    },
  });
  if (!license) return { ok: false, message: "License not found." };

  if (parsed.data.seats < license.seatsUsed) {
    return {
      ok: false,
      message: `Seats cannot be less than current usage (${license.seatsUsed}).`,
    };
  }

  await prisma.license.update({
    where: { id: license.id },
    data: {
      seats: parsed.data.seats,
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
    },
  });

  await writeAuditLog({
    userId: ctx.user.id,
    action: "license.update",
    entityType: "License",
    entityId: license.id,
  });

  revalidatePath("/org/licenses");
  return { ok: true, message: "License updated." };
}
