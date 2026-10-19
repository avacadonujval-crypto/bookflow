"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { ok: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <div className="surface-grain flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="animate-scale-in w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <div className="text-[17px] font-semibold tracking-[-0.03em]">
              BookFlow
            </div>
          </Link>
          <h1 className="mt-8 page-title">
            Reset password
          </h1>
          <p className="type-small mt-2">
            Enter your email and we&apos;ll send reset instructions if an
            account exists.
          </p>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-7 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>

            {state.message ? (
              <p className="text-sm text-foreground" role="status">
                {state.message}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm">
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
