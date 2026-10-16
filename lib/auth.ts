import {db} from './server';
import {RuleError,hasOrder} from './operations';
import {readModel} from './repository';
export async function identity(r:Request){const email=r.headers.get('oai-authenticated-user-email'),id=r.headers.get('oai-authenticated-user-id');if(!email||!id)throw new RuleError('Bitte anmelden.',401);let u:any=await db().prepare('SELECT * FROM users WHERE email=?').bind(email.toLowerCase()).first();if(!u){await db().prepare("INSERT OR IGNORE INTO users(id,email,role) SELECT ?,?,'Admin' WHERE NOT EXISTS(SELECT 1 FROM users)").bind(id,email.toLowerCase()).run();u=await db().prepare('SELECT * FROM users WHERE email=?').bind(email.toLowerCase()).first()}if(!u)throw new RuleError('Kein Benutzerkonto zugewiesen.',403);return u}
export function verifyOrigin(r:Request){if(r.headers.get('origin')!==new URL(r.url).origin)throw new RuleError('Ungültige Herkunft.',403)}
export async function authorizeOrder(r:Request,order:string){const u=await identity(r),s=await readModel(db());if(!hasOrder(s.model,u,order))throw new RuleError('Kein Zugriff auf diesen Auftrag.',403);return u}
