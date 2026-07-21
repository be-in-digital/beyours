"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";

/**
 * Back-office agence — module CRM v1 : inbox des leads entrants
 * (`contactSubmissions`), conversion en contact, liste + ajout de contacts
 * (prospection sortante).
 *
 * L'accès est gaté par `viewer.hasAccess` (affichage) ET par
 * `requireBackOfficeAccess` côté Convex (verrou dur). Design fonctionnel
 * dark/mint — un pass "premium" via DESIGN.md viendra ensuite.
 */
export default function BackOfficeHome() {
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);

  if (viewer === undefined) {
    return (
      <Screen>
        <p className="text-muted-foreground">Chargement…</p>
      </Screen>
    );
  }

  if (viewer === null) {
    return (
      <Screen>
        <p>Session expirée.</p>
        <a href="/back-office/signin" className="text-primary underline">
          Se reconnecter
        </a>
      </Screen>
    );
  }

  if (!viewer.hasAccess) {
    return (
      <Screen>
        <h1 className="text-lg font-medium">Accès en attente</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le compte <strong>{viewer.email}</strong> est créé mais pas encore
          activé. Un owner doit t’accorder un rôle.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground"
        >
          Se déconnecter
        </button>
      </Screen>
    );
  }

  return (
    <Crm
      email={viewer.email}
      role={viewer.role}
      onSignOut={() => void signOut()}
    />
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function Crm({
  email,
  role,
  onSignOut,
}: {
  email: string | null;
  role: string | null;
  onSignOut: () => void;
}) {
  const inbox = useQuery(api.crm.inbox);
  const contacts = useQuery(api.crm.contacts);
  const convertLead = useMutation(api.crm.convertLead);
  const markSubmission = useMutation(api.crm.markSubmission);
  const createContact = useMutation(api.crm.createContact);

  return (
    <main className="min-h-dvh bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-medium">Back-office agence</h1>
            <p className="text-xs text-muted-foreground">
              {email} · {role}
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground"
          >
            Se déconnecter
          </button>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Inbox leads */}
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Leads entrants
            </h2>
            <div className="mt-3 space-y-2">
              {inbox === undefined ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : inbox.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun lead.</p>
              ) : (
                inbox.map((lead) => (
                  <article
                    key={lead._id}
                    className="rounded-xl border border-border bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.email}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {lead.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {lead.message}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={lead.converted}
                        onClick={() =>
                          void convertLead({ submissionId: lead._id })
                        }
                        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {lead.converted ? "Converti" : "→ Contact"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void markSubmission({
                            id: lead._id,
                            status: "archived",
                          })
                        }
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        Archiver
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Contacts */}
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Contacts
            </h2>
            <AddContactForm
              onCreate={async (values) => {
                await createContact(values);
              }}
            />
            <div className="mt-3 space-y-2">
              {contacts === undefined ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun contact. Convertis un lead ou ajoute-en un.
                </p>
              ) : (
                contacts.map((c) => (
                  <article
                    key={c._id}
                    className="flex items-center justify-between rounded-xl border border-border bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.firstName} {c.lastName ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.email ?? "—"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {c.stage}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function AddContactForm({
  onCreate,
}: {
  onCreate: (values: {
    firstName: string;
    email?: string;
  }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim()) return;
    setPending(true);
    try {
      await onCreate({
        firstName: firstName.trim(),
        email: email.trim() || undefined,
      });
      setFirstName("");
      setEmail("");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
      <input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Nom"
        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Ajouter
      </button>
    </form>
  );
}
