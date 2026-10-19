"use client";

import { useActionState } from "react";
import { inviteOrAddUser, type OrgActionState } from "@/lib/actions/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: OrgActionState = { ok: false };

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteOrAddUser, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            required
            className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="STUDENT">Student</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="PUBLISHER">Publisher</option>
            <option value="ORG_ADMIN">Org admin</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Temporary password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="For new accounts only"
          />
        </div>
      </div>
      {state.message ? (
        <p className={state.ok ? "text-sm text-foreground" : "text-sm text-foreground"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add user"}
      </Button>
    </form>
  );
}
