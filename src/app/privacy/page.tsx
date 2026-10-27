import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy · Morning Dashboard" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="October 27, 2026">
      <h2>What the dashboard reads</h2>
      <p>When you connect accounts, the dashboard reads data only to show it to you:</p>
      <ul>
        <li>Google Calendar events from calendars your account can see, and Gmail message headers and snippets for the reply list.</li>
        <li>Todoist tasks, projects and labels.</li>
        <li>Your approximate location, if you allow the browser to share it, used to pick the weather forecast and time zone.</li>
      </ul>
      <p>With nothing connected, the dashboard shows frozen sample data and reads nothing about you.</p>
      <h2>What it changes</h2>
      <p>Only when you ask: completing or editing a task, creating or deleting a calendar event, and moving a message to the trash or to a label. Plan blocks are written to your Google Calendar and never to Todoist.</p>
      <h2>Where data goes</h2>
      <ul>
        <li>Open-Meteo receives your coordinates to return the forecast.</li>
        <li>Anthropic receives task and calendar titles to write the short day note, when an API key is configured. [Draft: confirm exactly which fields are sent.]</li>
        <li>Google and Todoist receive the requests needed to read and update your own data.</li>
      </ul>
      <h2>What is stored</h2>
      <ul>
        <li>Browser cookies for your display settings and last shared location.</li>
        <li>Your Google access and refresh tokens, in a Redis database or a local file on the server that runs the dashboard.</li>
      </ul>
      <p>Mail, calendar and task content is fetched on request and cached briefly by the server. It is not copied into a separate database. [Draft: confirm cache lifetimes.]</p>
      <h2>Your choices</h2>
      <p>Revoke access any time from your Google account permissions and Todoist integrations page, and clear the site cookies in your browser. [Draft: add a contact address for deletion requests.]</p>
    </LegalPage>
  );
}
