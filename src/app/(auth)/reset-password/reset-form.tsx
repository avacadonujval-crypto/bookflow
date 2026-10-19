"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { resetPassword, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { ok: false };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-block">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
              BookFlow
            </div>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              Enter a new password for your BookFlow account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="space-y-4">
                <p className="text-sm text-foreground">
                  This reset link is missing a token. Request a new reset email.
                </p>
                <Link href="/forgot-password">
                  <Button variant="outline" className="w-full">
                    Request reset link
                  </Button>
                </Link>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>

                {state.message ? (
                  <p
                    className={`text-sm ${state.ok ? "text-foreground" : "text-foreground"}`}
                    role="alert"
                  >
                    {state.message}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Updating..." : "Update password"}
                </Button>

                {state.ok ? (
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full">
                      Continue to sign in
                    </Button>
                  </Link>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
