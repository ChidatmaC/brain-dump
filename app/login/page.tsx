import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="page-gradient relative min-h-screen overflow-x-hidden">
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-12">
        <header className="mb-8 text-center">
          <p className="mb-3 font-[family-name:var(--font-outfit)] text-xs uppercase tracking-[0.28em] text-[var(--ink-muted)]">
            scatter the noise
          </p>
          <h1 className="font-[family-name:var(--font-syne)] text-5xl font-bold tracking-tight text-[var(--ink)]">
            Brain Dump
          </h1>
        </header>
        <LoginForm />
      </main>
    </div>
  );
}
