import {NextRequest,NextResponse} from 'next/server';
import {env} from 'cloudflare:workers';
import {identity} from '@/lib/auth';
import {db} from '@/lib/server';
import {createBackup} from '@/lib/backup';
export async function GET(r:NextRequest){
  try{return await createBackup(db(),env.BUCKET,await identity(r));}
  catch(e:any){return NextResponse.json({error:e.status?e.message:'Sicherung konnte nicht erstellt werden.'},{status:e.status||500,headers:{'Cache-Control':'no-store'}});}
}
