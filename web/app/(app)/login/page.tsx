import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AppShell } from "@/components/ui/app-shell";

export const metadata: Metadata = { title: "Sign in · RepSense" };

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
