import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-sm text-muted-foreground">
          Loading reset form…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
