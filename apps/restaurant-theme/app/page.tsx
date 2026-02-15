"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const currentUser = useQuery(api.auth.getCurrentUser);
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-lg space-y-6 p-8">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          BeInDigital Engine
        </h1>

        {currentUser === undefined && (
          <p className="text-zinc-500">Loading...</p>
        )}

        {currentUser === null && (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              You are not signed in.
            </p>
            <div className="flex gap-3">
              <Link
                href="/sign-in"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}

        {currentUser && (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Signed in as
              </p>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {currentUser.name}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {currentUser.email}
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign Out
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
