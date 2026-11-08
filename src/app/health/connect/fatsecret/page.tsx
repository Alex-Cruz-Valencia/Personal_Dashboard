import Link from 'next/link';
import { features, config } from '@/lib/config';
import { readDiaryTokens } from '@/lib/fatsecret/token-store';
import '@/components/health/health.css';

export const dynamic='force-dynamic';
export const metadata={title:'Connect FatSecret · Health'};
const messages:Record<string,string>={connected:'Your FatSecret account authorization was saved. Return to Health to load your food diary.',disconnected:'The dashboard’s saved diary authorization has been removed.',authentication:'The connection was not approved, expired, or rejected. Start a new connection and sign in with the account where you log your meals.',invalid_response:'FatSecret returned an unexpected authorization response. Try again.',unavailable:'FatSecret could not be reached. Please try again.',rate_limited:'FatSecret is limiting requests. Please try later.',credentials_required:'Add the separate OAuth 1.0 consumer credentials to the server environment first.',disabled:'Diary connections are disabled in demo mode.',configuration:'Check FATSECRET_REDIRECT_URI. It must point to this dashboard’s /api/auth/fatsecret/callback route.',storage_unavailable:'The connection could not be saved. Check private server token storage; Vercel requires private Redis.'};
export default async function ConnectFatSecret({searchParams}:{searchParams:Promise<{status?:string}>}) {
  const {status}=await searchParams;
  const configured=Boolean(config.fatsecret.consumerKey && config.fatsecret.consumerSecret);
  let connected=false,storageFailed=false;
  try {connected=features.fatsecretDiary && Boolean(await readDiaryTokens());} catch {storageFailed=true;}
  return <main className="legal"><Link href="/health" className="legal__back">← Back to Health</Link><h1>Connect your food diary</h1>
    {status && messages[status] ? <p role="status">{messages[status]}</p> : null}
    {storageFailed ? <p role="alert">Your saved authorization could not be read. Check private server token storage.</p> : null}
    <p>Connect the FatSecret account where you already log meals. You’ll sign in and approve access on FatSecret’s own website; this dashboard does not ask for your FatSecret password.</p>
    {connected ? <><h2>Account authorized</h2><p>Your account connection is saved. Health reads your food entries and totals; it does not add, edit or delete meals.</p><Link href="/health" className="health-btn">View today’s nutrition</Link><form method="post" action="/api/auth/fatsecret/disconnect"><button className="health-btn health-btn--quiet" type="submit">Disconnect food diary</button></form></> : configured && features.fatsecretDiary ? <form method="post" action="/api/auth/fatsecret"><button className="health-btn" type="submit">Sign in with FatSecret</button></form> : <><h2>{configured ? 'Disabled in demo mode' : 'Add your diary connection credentials'}</h2><p>The Client ID and Client Secret already configured are for food-database access. Diary authorization uses the separate OAuth 1.0 Consumer Key and Consumer Secret.</p><p>Add these to the server’s ignored <code>.env.local</code> file, then restart the local server:</p><pre>{'FATSECRET_CONSUMER_KEY="your-consumer-key"\nFATSECRET_CONSUMER_SECRET="your-consumer-secret"'}</pre><p>Keep your existing Client ID/Secret. Do not put real values in source code or browser storage.</p></>}
    <h2>Where authorization is stored</h2><p>Account tokens are encrypted on the server using the consumer secret, in private Redis or an owner-only file under the ignored .data directory. Changing the consumer credentials requires reconnecting. On hosted Vercel deployments, configure private Redis for token persistence.</p><p>Authorization permits account-level API access; this dashboard implements read-only food-diary requests. Keep this personal dashboard private.</p>
  </main>;
}
