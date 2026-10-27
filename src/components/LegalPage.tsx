import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">Back to dashboard</Link>
      <h1>{title}</h1>
      <p>
        <span className="legal__draft">Draft for review</span>
      </p>
      <p className="legal__meta">Last updated {updated}. This is a personal project; the text below describes what the code does today and has not been reviewed by a lawyer.</p>
      {children}
    </main>
  );
}
