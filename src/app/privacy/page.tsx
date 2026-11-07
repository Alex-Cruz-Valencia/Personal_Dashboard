import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy · Morning Dashboard" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="November 7, 2026">
      <h2>What the dashboard reads</h2>
      <p>When you connect accounts, the dashboard reads data only to show it to you:</p>
      <ul>
        <li>Google Calendar events from calendars your account can see, and Gmail message headers and snippets for the reply list.</li>
        <li>Todoist tasks, projects and labels.</li>
        <li>Your approximate location, if you allow the browser to share it, used to pick the weather forecast and time zone.</li>
      </ul>
      <p>With nothing connected, the morning dashboard shows frozen sample data. The Health page also shows sample training and trends, alongside any check-ins you choose to enter.</p>
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
        <li>Health check-ins (energy, sleep, soreness, steps, water and notes), independently logged water, and targets (including optional protein/calorie targets) in this browser’s local storage, under <code>dashboard_health_v1</code>. Up to 90 daily entries are retained. These entries do not sync across devices and are not sent to the server, Hevy or an AI service.</li>
      </ul>
      <p>Mail, calendar and task content is fetched on request and cached briefly by the server. It is not copied into a separate database. [Draft: confirm cache lifetimes.]</p>
      <h2>Optional Hevy API access</h2>
      <p>If you configure a Hevy API key, the server reads your workout history, routines, exercise details and preferred weight units to display your training data on Health. The key stays in the server environment and is never sent to the browser. Workouts are cached in server memory for five minutes and exercise details for up to an hour, without writing a separate workout database or files. If a refresh fails, a clearly labeled previous sync may be shown for up to 24 hours. Hevy data is not sent to an AI service and the dashboard makes no changes to Hevy. The connection check returns only connection status and total workout count.</p>
      <h2>Optional FatSecret application access</h2>
      <p>If configured, the connection check sends application credentials only to FatSecret’s official token service. Credentials stay in the server environment, and temporary access tokens are kept only in server memory until shortly before expiry. Neither credentials nor tokens are returned to the browser or sent to an AI service. This checks application-level food database authentication; it does not connect to your personal food diary. No meals, nutrition records or FatSecret user tokens are currently fetched or stored.</p>
      <h2>Your choices</h2>
      <p>On Health, edit or delete today’s check-in from the check-in form. Clear this site’s browser storage to remove all saved check-ins and health targets.</p>
      <p>Revoke access any time from your Google account permissions and Todoist integrations page, and clear the site cookies in your browser. [Draft: add a contact address for deletion requests.]</p>
    </LegalPage>
  );
}
