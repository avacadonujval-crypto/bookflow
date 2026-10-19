"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { registerUser, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { ok: false };

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    registerUser,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      router.push("/login");
    }
  }, [state.ok, router]);

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
            Create your account
          </h1>
          <p className="type-small mt-2">
            Choose the role that matches how you will use BookFlow.
          </p>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-7 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <p className="type-small">
                Use at least 8 characters with letters and numbers.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                required
                defaultValue="STUDENT"
                className="flex h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-sm text-foreground focus-visible:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              >
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="PUBLISHER">Publisher</option>
                <option value="ORG_ADMIN">Organization admin</option>
              </select>
            </div>

            {state.message ? (
              <p className="text-sm text-foreground" role="alert">
                {state.message}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm font-light text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
