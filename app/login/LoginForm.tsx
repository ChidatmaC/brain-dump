"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "signIn" | "signUp";

const inputClass =
  "w-full rounded-xl border border-[var(--bubble-border)] bg-[var(--bubble)] px-4 py-2.5 text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--ink-muted)]";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error } =
      mode === "signIn"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name || email });

    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 font-[family-name:var(--font-outfit)]"
    >
      {mode === "signUp" && (
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          autoComplete="name"
        />
      )}
      <input
        type="email"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Password (min 8 characters)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
      />

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl border border-[var(--bubble-border)] bg-[var(--bubble-solid)] px-4 py-2.5 font-medium text-[var(--ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setError(null);
        }}
        className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        {mode === "signIn" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
