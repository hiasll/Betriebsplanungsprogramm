import {can} from './permissions';
import {RuleError} from './operations';

const encode=new TextEncoder();
const quoted=(name:string)=>'"'+name.replaceAll('"','""')+'"';
export async function sha256(bytes:ArrayBuffer){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function base64(bytes:Uint8Array){
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
}
export async function createBackup(db:any,bucket:AppBucket,user:any){
  if(!can(user,'users.manage')||!can(user,'finance.view'))throw new RuleError('Keine Berechtigung.',403);
  const names=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results.map((t:any)=>t.name);
  // All tables are read in one D1 transaction. Objects are immutable and content-addressed.
  const rows=await db.batch(names.map((name:string)=>db.prepare(`SELECT * FROM ${quoted(name)}`)));
  const tables=Object.fromEntries(names.map((name:string,i:number)=>[name,rows[i].results]));
  const header={type:'database',format:'metallwerk-backup-v2',createdAt:new Date().toISOString(),tables};
  const databaseJson=JSON.stringify(header);
  const databaseSha256=await sha256(encode.encode(databaseJson).buffer as ArrayBuffer);
  async function* records(){
    yield encode.encode(databaseJson+'\n');
    const files=[];
    for(const row of tables.documents||[]){
      const doc=JSON.parse(row.data),key=doc.storageKey||doc.id;
      const object=await bucket.get(key);
      if(!object)throw new Error('Dokument fehlt: '+doc.id);
      const bytes=await new Response(object.body).arrayBuffer();
      const checksum=await sha256(bytes);
      if((doc.checksum&&doc.checksum!==checksum)||(doc.size!==undefined&&Number(doc.size)!==bytes.byteLength))throw new Error('Dokumentprüfung fehlgeschlagen: '+doc.id);
      const file={id:doc.id,key,size:bytes.byteLength,sha256:checksum,mime:doc.mime||'application/octet-stream'};
      files.push(file);
      yield encode.encode(JSON.stringify({type:'file',...file,base64:base64(new Uint8Array(bytes))})+'\n');
    }
    // Missing footer makes interrupted/failed downloads unambiguously invalid.
    yield encode.encode(JSON.stringify({type:'complete',databaseSha256,files})+'\n');
  }
  const iterator=records();
  return new Response(new ReadableStream({
    async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(e){controller.error(e);}},
    async cancel(){await iterator.return(undefined);}
  }),{headers:{'Content-Type':'application/x-ndjson','Content-Disposition':`attachment; filename="metallwerk-vollsicherung-${new Date().toISOString().slice(0,10)}.ndjson"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
