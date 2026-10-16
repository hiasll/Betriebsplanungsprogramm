// Offline recovery only: creates a NEW directory; never connects to production.
import {createReadStream} from 'node:fs';
import {mkdir,readFile,readdir,writeFile,rename,rm,lstat} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
export async function restoreBackup(input,destination){
  const target=resolve(destination);
  try{await lstat(target);throw new Error('Ziel existiert bereits. Neues leeres Ziel wählen.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(target,{recursive:false,mode:0o700});
  const staging=join(target,'incomplete-'+randomUUID());
  await mkdir(staging,{mode:0o700});await mkdir(join(staging,'files'),{mode:0o700});
  let sql,header,databaseHash,footer;const files=[],seen=new Set();
  try{
    for await(const line of createInterface({input:createReadStream(input),crlfDelay:Infinity})){
      if(!line.trim())continue;
      if(footer)throw new Error('Daten nach dem Abschlussvermerk.');
      const record=JSON.parse(line);
      if(!header){
        if(record.type!=='database'||record.format!=='metallwerk-backup-v2')throw new Error('Unbekanntes Sicherungsformat.');
        header=record;databaseHash=hash(line);
        sql=new DatabaseSync(join(staging,'database.sqlite'));
        // Only trusted local migrations are executed, never SQL from a backup.
        const migrations=fileURLToPath(new URL('../drizzle/',import.meta.url));
        for(const name of (await readdir(migrations)).filter(n=>/^\d.*\.sql$/.test(n)).sort())sql.exec(await readFile(join(migrations,name),'utf8'));
        const expected=sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x=>x.name);
        for(const name of expected)if(!Object.hasOwn(header.tables,name))throw new Error('Tabelle fehlt: '+name);
        sql.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
        for(const [name,rows] of Object.entries(header.tables)){
          if(!expected.includes(name)){
            if(['d1_migrations','__drizzle_migrations'].includes(name))continue;
            throw new Error('Unbekannte Tabelle: '+name);
          }
          for(const row of rows){const cols=Object.keys(row);sql.prepare(`INSERT INTO ${quote(name)} (${cols.map(quote).join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c]));}
        }
      }else if(record.type==='file'){
        const doc=header.tables.documents.map(r=>JSON.parse(r.data)).find(d=>d.id===record.id);
        if(!doc||seen.has(record.id)||record.key!==(doc.storageKey||doc.id)||!/^[a-zA-Z0-9-]{1,200}$/.test(record.key))throw new Error('Ungültige oder doppelte Dateizuordnung.');
        const bytes=Buffer.from(record.base64,'base64');
        if(bytes.toString('base64')!==record.base64||bytes.length!==record.size||hash(bytes)!==record.sha256||(doc.checksum&&doc.checksum!==record.sha256)||(doc.size!==undefined&&Number(doc.size)!==bytes.length))throw new Error('Dateiprüfung fehlgeschlagen.');
        await writeFile(join(staging,'files',record.key),bytes,{flag:'wx',mode:0o600});
        const {base64,...info}=record;delete info.type;files.push(info);seen.add(record.id);
      }else if(record.type==='complete')footer=record;
      else throw new Error('Unbekannter Sicherungseintrag.');
    }
    if(!header||!footer||footer.databaseSha256!==databaseHash||JSON.stringify(footer.files)!==JSON.stringify(files)||seen.size!==header.tables.documents.length)throw new Error('Sicherung unvollständig oder beschädigt.');
    if(sql.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Beziehungen der Datenbank sind beschädigt.');
    if(sql.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Datenbankprüfung fehlgeschlagen.');
    sql.exec('COMMIT');sql.close();sql=null;
    await writeFile(join(staging,'manifest.json'),JSON.stringify({format:header.format,createdAt:header.createdAt,databaseSha256:databaseHash,files},null,2),{mode:0o600});
    await rename(staging,join(target,'complete'));
    return {directory:join(target,'complete'),tables:Object.keys(header.tables).length,files:files.length};
  }catch(e){if(sql)sql.close();await rm(target,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [input,target]=process.argv.slice(2);
  if(!input||!target){console.error('Aufruf: node scripts/restore-backup.mjs SICHERUNG.ndjson NEUES-ZIEL');process.exitCode=1;}
  else try{console.log(JSON.stringify(await restoreBackup(input,target)));}catch(e){console.error(e.message);process.exitCode=1;}
}
