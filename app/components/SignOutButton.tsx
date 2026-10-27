"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-full border border-[var(--bubble-border)] bg-[var(--bubble)] px-3 py-1 text-[var(--ink)] transition-colors hover:bg-[var(--bubble-solid)]"
    >
      Sign out
    </button>
  );
}
