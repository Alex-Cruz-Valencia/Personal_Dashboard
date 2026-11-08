import 'server-only';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Redis } from '@upstash/redis';
import { config } from '@/lib/config';
import type { DiaryTokens } from './oauth1';

const url=process.env.UPSTASH_REDIS_REST_URL??process.env.KV_REST_API_URL;
const secret=process.env.UPSTASH_REDIS_REST_TOKEN??process.env.KV_REST_API_TOKEN;
const kv=url&&secret?new Redis({url,token:secret}):null;
const dir=join(process.cwd(),'.data','fatsecret');
const credentialsKey='dashboard:fatsecret:tokens';
const pendingKey=(state:string)=>`dashboard:fatsecret:pending:${state}`;
const validState=(state:string)=>/^[a-f0-9]{64}$/.test(state);
const validTokens=(v:unknown):v is DiaryTokens=>!!v&&typeof v==='object'&&typeof (v as DiaryTokens).token==='string'&&typeof (v as DiaryTokens).secret==='string'&&(v as DiaryTokens).token.length>0&&(v as DiaryTokens).token.length<=2048&&(v as DiaryTokens).secret.length>0&&(v as DiaryTokens).secret.length<=2048;
function encryptionKey() {
  if(!config.fatsecret.consumerKey || !config.fatsecret.consumerSecret) throw new Error('FatSecret diary storage is not configured.');
  return createHash('sha256').update(`fatsecret-token-store-v1\0${config.fatsecret.consumerKey}\0${config.fatsecret.consumerSecret}`).digest();
}
export function encryptDiarySecret(data: unknown): string {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const body=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),body].map(v=>v.toString('base64url')).join('.');
}
export function decryptDiarySecret(value: string): unknown {
  try {
    const parts=value.split('.'); if(parts.length!==3) return null;
    const [iv,tag,body]=parts.map(v=>Buffer.from(v,'base64url'));
    const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8'));
  } catch { return null; }
}
async function atomicFile(name:string, value:string) {
  if(process.env.VERCEL) throw new Error('Private Redis is required for FatSecret diary tokens on Vercel.');
  await mkdir(dir,{recursive:true,mode:0o700});
  const temp=join(dir,`.${randomBytes(16).toString('hex')}.tmp`);
  try {await writeFile(temp,value,{mode:0o600,flag:'wx'});await rename(temp,join(dir,name));}
  finally {await rm(temp,{force:true});}
}
export async function readDiaryTokens(): Promise<DiaryTokens|null> {
  if(!config.fatsecret.consumerKey || !config.fatsecret.consumerSecret) return null;
  let raw: string|null;
  if(kv) raw=await kv.get<string>(credentialsKey);
  else { try {raw=await readFile(join(dir,'tokens.enc'),'utf8');} catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT') return null;throw new Error('FatSecret diary storage unavailable.');} }
  const data=raw?decryptDiarySecret(raw):null;
  return validTokens(data)?data:null;
}
export async function writeDiaryTokens(tokens:DiaryTokens) {
  const value=encryptDiarySecret(tokens);
  if(kv) await kv.set(credentialsKey,value); else await atomicFile('tokens.enc',value);
}
export async function clearDiaryTokens() {
  if(kv) await kv.del(credentialsKey); else await rm(join(dir,'tokens.enc'),{force:true});
}
export async function savePendingDiary(state:string,tokens:DiaryTokens) {
  if(!validState(state)) throw new Error('Invalid FatSecret connection state.');
  const value=encryptDiarySecret({...tokens,expiresAt:Date.now()+600000});
  if(kv) {await kv.set(pendingKey(state),value,{ex:600});return;}
  await atomicFile(`${state}.pending`,value);
  // Expired request tokens must not accumulate in the local fallback.
  for(const name of await readdir(dir)) if(/^[a-f0-9]{64}\.pending$/.test(name)) {
    const file=join(dir,name);
    try {if(Date.now()-(await stat(file)).mtimeMs>600000) await rm(file,{force:true});} catch {/* Another callback may have consumed it. */}
  }
}
/** Atomic consume prevents callback replays, including concurrent requests. */
export async function consumePendingDiary(state:string):Promise<DiaryTokens|null> {
  if(!validState(state)) return null;
  let raw:string|null=null;
  if(kv) raw=await kv.getdel<string>(pendingKey(state));
  else {
    const claimed=join(dir,`${state}.${randomBytes(12).toString('hex')}.claimed`);
    try {await rename(join(dir,`${state}.pending`),claimed);raw=await readFile(claimed,'utf8');}
    catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT') throw new Error('FatSecret diary storage unavailable.');}
    finally {await rm(claimed,{force:true});}
  }
  const data=raw?decryptDiarySecret(raw):null;
  if(!validTokens(data)||typeof (data as DiaryTokens & {expiresAt?:number}).expiresAt!=='number'||(data as DiaryTokens & {expiresAt:number}).expiresAt<=Date.now()) return null;
  return {token:data.token,secret:data.secret};
}
