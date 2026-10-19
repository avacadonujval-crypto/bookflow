"use client";

import { useActionState } from "react";
import {
  updateOrganizationLicense,
  type OrgActionState,
} from "@/lib/actions/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: OrgActionState = { ok: false };

export function LicenseUpdateForm({
  licenseId,
  seats,
  isActive,
}: {
  licenseId: string;
  seats: number;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateOrganizationLicense,
    initial,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
      <input type="hidden" name="licenseId" value={licenseId} />
      <div className="space-y-1">
        <Label htmlFor={`seats-${licenseId}`}>Seats</Label>
        <Input
          id={`seats-${licenseId}`}
          name="seats"
          type="number"
          min={1}
          defaultValue={seats}
          className="w-28"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={isActive}
          value="true"
        />
        Active
      </label>
      {state.message ? (
        <p className={state.ok ? "text-sm text-foreground" : "text-sm text-foreground"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Update
      </Button>
    </form>
  );
}
