import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms · Morning Dashboard" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 27, 2026">
      <h2>What this is</h2>
      <p>Morning Dashboard is a personal project that shows weather, tasks, calendar and mail in one view. The public demo uses sample data only.</p>
      <h2>Using it</h2>
      <p>You may use the demo freely. If you connect your own accounts, you are responsible for the access you grant and for actions you take, such as trashing a message or deleting an event.</p>
      <h2>No warranty</h2>
      <p>The service is provided as is. Weather, schedules and suggested plans can be wrong or out of date, so check anything important at its source. [Draft: have a lawyer review the warranty and liability wording.]</p>
      <h2>Third-party services</h2>
      <p>Data from Google, Todoist, Open-Meteo and Anthropic is subject to the terms of those services.</p>
      <h2>Changes and contact</h2>
      <p>These terms may change. [Draft: add owner name, governing law and a contact address.]</p>
    </LegalPage>
  );
}
