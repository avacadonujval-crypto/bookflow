"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { loginUser, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { ok: false };

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const sessionExpired = searchParams.get("error") === "session_expired";
  const [state, formAction, pending] = useActionState(loginUser, initialState);

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
            Sign in
          </h1>
          <p className="type-small mt-2">
            Welcome back to your workspace.
          </p>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-7 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          {sessionExpired ? (
            <p className="mb-5 rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-foreground">
              Your session expired. Sign in again to continue.
            </p>
          ) : null}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                data-testid="login-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                data-testid="login-password"
              />
            </div>

            {state.message ? (
              <p className="text-sm text-foreground" role="alert">
                {state.message}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={pending}
              data-testid="login-submit"
            >
              {pending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm font-light text-muted-foreground">
            New to BookFlow?{" "}
            <Link
              href="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
