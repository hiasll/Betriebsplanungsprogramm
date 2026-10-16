import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
mkdirSync('work',{recursive:true});
await build({stdin:{contents:"export * from './lib/order-ledger';export * from './lib/planning-form';export * from './lib/operations';export * from './lib/repository';export * from './lib/time';export * from './lib/permissions';export * from './lib/seed';export * from './lib/maintenance';export * from './lib/backup';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'work/operations-test-bundle.mjs'});
const {reduceOperation,executeCommand,readModel,changeStatement,publicModel,interval,toInstant,splitInterval,localParts,calculate,seed,permissionsFor,runMaintenanceJob,createBackup}=await import('../work/operations-test-bundle.mjs');
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');this.sql.exec(readFileSync('drizzle/0000_old_spiral.sql','utf8'));this.sql.exec(readFileSync('drizzle/0001_wide_misty_knight.sql','utf8'));this.sql.exec("INSERT INTO app_revision(id,revision) VALUES('main',0)")}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this},async first(){return db.sql.prepare(sql).get(...this.args)||null},async all(){return {results:db.sql.prepare(sql).all(...this.args)}},async run(){const r=db.sql.prepare(sql).run(...this.args);return {results:[],meta:{changes:Number(r.changes)}}},sql}}
 async batch(stmts){this.sql.exec('BEGIN IMMEDIATE');try{const results=stmts.map(s=>{const p=this.sql.prepare(s.sql);if(p.columns().length)return {results:p.all(...s.args),meta:{changes:0}};const r=p.run(...s.args);return {results:[],meta:{changes:Number(r.changes)}}});this.sql.exec('COMMIT');return results}catch(e){this.sql.exec('ROLLBACK');throw e}}
}
const admin={id:'admin',email:'admin@test.invalid',role:'Admin',version:1,overrides:'{}'},worker={id:'worker',email:'worker@test.invalid',role:'Monteur',employee_id:'e1',version:1,overrides:'{}'},admin2={...admin,id:'admin2',email:'admin2@test.invalid'};
async function fixture(){const d=new D1();for(const [kind,items] of Object.entries(seed))for(const x of items)await d.batch([changeStatement(d,{kind,item:{...x,version:1}})]);for(const u of [admin,worker,admin2])await d.batch([changeStatement(d,{kind:'users',item:u})]);await executeCommand(d,admin,{action:'initialize'},crypto.randomUUID());return d}
const run=(d,u,command,key=crypto.randomUUID(),now)=>executeCommand(d,u,command,key,now);
const model=async d=>(await readModel(d)).model;
const monday='2030-01-07';
const team=(date=monday,extra={})=>({action:'team',item:{order:'o1',date,endDate:date,start:'07:00',end:'12:00',members:[{employee:'e1'},{employee:'e2'}],resources:[],...extra}});
let passed=0;
async function check(name,fn){await test(name,async()=>{await fn();passed++})}
await check('Migration erhält bestehende Aufträge und legt neue Tabellen additiv an',async()=>{const d=await fixture(),m=await model(d);assert.equal(m.orders.length,seed.orders.length);assert.equal(m.employees.length,5);assert.equal(m.templates.length,6);assert.equal(d.sql.prepare('PRAGMA foreign_key_check').all().length,0)});
await check('Team wird atomar gespeichert und gemeinsam verschoben',async()=>{const d=await fixture();await run(d,admin,team());let m=await model(d);const a=m.assignments.find(a=>a.date===monday);assert.equal(m.assignments.filter(b=>b.mission===a.mission).length,2);await run(d,admin,{action:'move',item:{...a,date:'2030-01-08',start:'08:00',scope:'team'}});m=await model(d);assert(m.assignments.filter(b=>b.mission===a.mission).every(b=>b.date==='2030-01-08'&&b.start==='08:00'))});
await check('Einzelverschiebung erhält das andere Teammitglied',async()=>{const d=await fixture();await run(d,admin,team());let m=await model(d),a=m.assignments.find(a=>a.date===monday&&a.employee==='e1');await run(d,admin,{action:'move',item:{...a,date:'2030-01-08',scope:'single'}});m=await model(d);assert(m.assignments.some(b=>b.mission===a.mission&&b.employee==='e2'&&b.date===monday))});
await check('Doppelbelegung wird gespeichert und als Warnung zurückgegeben',async()=>{const d=await fixture();await run(d,admin,team());const before=await model(d);const result=await run(d,admin,team(monday,{members:[{employee:'e3'},{employee:'e1'}]}));assert(result.notices.some(s=>s.includes('Doppelbelegung')));const after=await model(d);assert.equal(after.assignments.length,before.assignments.length+2);assert.equal(after.missions.length,before.missions.length+1)});
await check('Ressourcenkollision und Sperrzeit speichern mit Warnung',async()=>{const d=await fixture();await run(d,admin,{action:'save',kind:'resources',item:{id:'r1',name:'Testtransporter',type:'Fahrzeug',active:true}});await run(d,admin,team(monday,{resources:['r1']}));const r=await run(d,admin,team(monday,{members:[{employee:'e3'}],resources:['r1']}));assert(r.notices.some(s=>s.includes('Ressource bereits belegt')));const block=await run(d,admin,{action:'save',kind:'resourceBlocks',item:{resource:'r1',date:monday,endDate:monday,start:'09:00',end:'10:00',reason:'Prüfung'}});assert(block.notices.some(s=>s.includes('Ressource gesperrt')))});
await check('Einteilung trotz Abwesenheit wird mit Warnung gespeichert',async()=>{const d=await fixture();await run(d,admin,{action:'save',kind:'absences',item:{employee:'e1',date:monday,end:monday,type:'Urlaub'}});const r=await run(d,admin,team());assert(r.notices.some(s=>s.includes('abwesend')));assert((await model(d)).assignments.some(a=>a.employee==='e1'&&a.date===monday))});
await check('Gleichzeitige Einteilungen bleiben vollständig und doppelte Mitarbeiter dürfen gewarnt eingeplant werden',async()=>{const d=await fixture(),users=[admin,admin2],commands=[team(),team()],keys=[crypto.randomUUID(),crypto.randomUUID()];const r=await Promise.allSettled(users.map((u,i)=>run(d,u,commands[i],keys[i])));for(let i=0;i<r.length;i++)if(r[i].status==='rejected'){assert.equal(r[i].reason.status,409);await run(d,users[i],commands[i],keys[i]);}const rows=(await model(d)).assignments.filter(x=>x.date===monday);assert.equal(rows.length,4);assert.equal(new Set(rows.map(x=>x.id)).size,4)});
await check('Idempotente Wiederholung erzeugt keinen zweiten Einsatz',async()=>{const d=await fixture(),key=crypto.randomUUID();await run(d,admin,team(),key);const again=await run(d,admin,team(),key);assert(again.repeated);assert.equal((await model(d)).assignments.filter(x=>x.date===monday).length,2)});
await check('Fremde Rollen- und Auftragsänderungen werden abgelehnt',async()=>{const d=await fixture();await assert.rejects(run(d,worker,team()),e=>e.status===403);await assert.rejects(run(d,worker,{action:'users',item:{email:'evil@test.invalid',role:'Admin'}}),e=>e.status===403);const m=await model(d);await assert.rejects(run(d,worker,{action:'save',kind:'orders',item:{...m.orders[0],title:'Unzulässig'}}),e=>e.status===403)});
await check('Individuelle Sperre wirkt serverseitig trotz Admin-Rolle',async()=>{const d=await fixture(),m=await model(d),u=m.users.find(x=>x.id==='admin2');await run(d,admin,{action:'users',item:{...u,overrides:{'planning.manage':false}}});await assert.rejects(run(d,admin2,team()),e=>e.status===403)});
await check('Kosten und fremde Zeiten fehlen in Mitarbeiterantworten',async()=>{const d=await fixture();let m=await model(d);await run(d,admin,{action:'save',kind:'employees',item:{...m.employees[0],hourlyRate:78}});m=await model(d);const pub=publicModel(m,worker);assert(pub.times.every(t=>t.employee==='e1'));assert(!JSON.stringify(pub).includes('hourlyRate'));assert(pub.orders.every(o=>m.assignments.some(a=>a.employee==='e1'&&a.order===o.id)));assert.equal(pub.users.length,0)});
await check('Timer ist geräteunabhängig und erlaubt Pause, Fortsetzen und Stoppen',async()=>{const d=await fixture(),start=Date.parse('2030-01-07T06:00:00Z');await run(d,worker,{action:'timer',item:{operation:'start',employee:'e1',order:'o1',type:'Produktion'}},crypto.randomUUID(),start);await assert.rejects(run(d,worker,{action:'timer',item:{operation:'start',employee:'e1',order:'o1',type:'Produktion'}},crypto.randomUUID(),start+1000),/bereits/);let t=(await model(d)).timers.find(t=>t.active);await run(d,worker,{action:'timer',item:{operation:'pause',employee:'e1',version:t.version}},crypto.randomUUID(),start+3600000);t=(await model(d)).timers.find(t=>t.active);assert.equal(t.state,'paused');await run(d,worker,{action:'timer',item:{operation:'resume',employee:'e1',version:t.version}},crypto.randomUUID(),start+5400000);t=(await model(d)).timers.find(t=>t.active);await run(d,worker,{action:'timer',item:{operation:'stop',employee:'e1',version:t.version}},crypto.randomUUID(),start+9000000);const times=(await model(d)).times.filter(t=>t.date===monday);assert.equal(times.filter(t=>t.type==='Pause').reduce((n,t)=>n+t.hours,0),.5);assert.equal(times.filter(t=>t.type!=='Pause').reduce((n,t)=>n+t.hours,0),2)});
await check('Zeitbuchung über Mitternacht wird in zwei Tage aufgeteilt',async()=>{const d=await fixture();await run(d,worker,{action:'time',item:{employee:'e1',order:'o1',date:monday,endDate:'2030-01-08',start:'23:00',end:'02:00',type:'Montage'}});const t=(await model(d)).times.filter(t=>t.date>='2030');assert.equal(t.length,2);assert.equal(t.reduce((n,t)=>n+t.hours,0),3)});
await check('Sommerzeitlücke und doppelte Stunde werden korrekt behandelt',async()=>{assert.throws(()=>toInstant('2030-03-31','02:30','Europe/Vienna'),/existiert/);const a=toInstant('2030-10-27','02:30','Europe/Vienna','earlier'),b=toInstant('2030-10-27','02:30','Europe/Vienna','later');assert.equal(b-a,3600000)});
await check('Überlappende Zeitbuchung wird abgelehnt',async()=>{const d=await fixture();const c={action:'time',item:{employee:'e1',order:'o1',date:monday,endDate:monday,start:'07:00',end:'10:00',type:'Produktion'}};await run(d,worker,c);await assert.rejects(run(d,worker,c),/überschneidet/)});
await check('Tagesfreigabe und begründete Korrektur funktionieren',async()=>{const d=await fixture();await run(d,worker,{action:'time',item:{employee:'e1',order:'o1',date:monday,endDate:monday,start:'07:00',end:'10:00',type:'Produktion'}});await run(d,worker,{action:'day',item:{employee:'e1',date:monday,status:'Eingereicht'}});let r=(await model(d)).dayReports[0];await run(d,admin,{action:'day',item:{...r,status:'Freigegeben'}});let t=(await model(d)).times.find(t=>t.date===monday);await assert.rejects(run(d,worker,{action:'time',item:{...t,end:'11:00'}}),e=>e.status===403);await assert.rejects(run(d,admin,{action:'time',item:{...t,end:'11:00'}}),/begründung/i);await run(d,admin,{action:'time',item:{...t,end:'11:00',reason:'Korrektur nach Rücksprache'}});r=(await model(d)).dayReports[0];assert.equal(r.status,'Zurückgegeben')});
await check('Material darf nicht doppelt reserviert werden',async()=>{const d=await fixture(),m=await model(d),inv=m.inventory.find(i=>i.id==='legacy-m1');await run(d,admin,{action:'save',kind:'materials',item:{id:'line-test',order:'o2',inventory:inv.id,name:inv.name,quantity:20,unit:'m'}});await assert.rejects(run(d,admin,{action:'stock',item:{inventory:inv.id,line:'line-test',quantity:20,action:'Reservierung'}}),/Nicht genügend/);await run(d,admin,{action:'stock',item:{inventory:inv.id,line:'line-test',quantity:10,action:'Reservierung'}});assert.equal((await model(d)).materials.find(l=>l.id==='line-test').reserved,10)});
await check('Wareneingang, Reservierung und Verbrauch aktualisieren Materialstatus',async()=>{const d=await fixture();await run(d,admin,{action:'stock',item:{inventory:'legacy-m2',line:'m2',quantity:1,action:'Wareneingang'}});await run(d,admin,{action:'stock',item:{inventory:'legacy-m2',line:'m2',quantity:1,action:'Reservierung'}});assert.equal((await model(d)).orders.find(o=>o.id==='o3').material,'Vollständig');await run(d,admin,{action:'stock',item:{inventory:'legacy-m2',line:'m2',quantity:1,action:'Verbrauch'}});const m=await model(d);assert.equal(m.inventory.find(i=>i.id==='legacy-m2').stock,0);assert.equal(m.materials.find(l=>l.id==='m2').consumed,1);assert.equal(m.movements.length,3)});
await check('Materialkorrektur benötigt Begründung und akzeptiert Nullbestand',async()=>{const d=await fixture();await assert.rejects(run(d,admin,{action:'stock',item:{inventory:'legacy-m2',quantity:0,action:'Korrektur'}}),/begründung/i);await run(d,admin,{action:'stock',item:{inventory:'legacy-m2',quantity:0,action:'Korrektur',reason:'Inventur'}})});
await check('Rückmeldung erzeugt Folgebedarf, schließt aber nicht den Gesamtauftrag',async()=>{const d=await fixture(),a=(await model(d)).assignments.find(a=>a.employee==='e1');await run(d,worker,{action:'feedback',item:{assignment:a.id,status:'Folgetermin nötig',remaining:'Nacharbeit',requiredMaterial:'Schrauben',notes:'Test erledigt',consumption:[]}});const m=await model(d);assert.equal(m.orders.find(o=>o.id===a.order).followUp,true);assert.notEqual(m.orders.find(o=>o.id===a.order).status,'Fertig');assert.equal(m.assignments.find(x=>x.id===a.id).completion,'Folgetermin nötig')});
await check('Vorlagen werden kopiert und bleiben unabhängig',async()=>{const d=await fixture();await run(d,admin,{action:'fromTemplate',item:{template:'template-0',customer:'c1',title:'Vorlagentest',date:monday,end:monday}});const before=(await model(d)).orders.find(o=>o.title==='Vorlagentest');let t=(await model(d)).templates[0];await run(d,admin,{action:'save',kind:'templates',item:{...t,name:'Geändert',steps:'Anderer Schritt'}});const after=(await model(d)).orders.find(o=>o.id===before.id);assert.deepEqual(after.templateSnapshot,before.templateSnapshot);assert((await model(d)).tasks.some(t=>t.order===before.id))});
await check('Wartungsauftrag ist pro Plan und Termin idempotent',async()=>{const d=await fixture();await run(d,admin,{action:'save',kind:'maintenance',item:{id:'maintenance-test',name:'Tor',customer:'c1',nextDue:monday,intervalDays:365,leadDays:14}});const key='wartung-test';await run(d,admin,{action:'generateMaintenance',item:{id:'maintenance-test'}},key);await run(d,admin,{action:'generateMaintenance',item:{id:'maintenance-test'}},key);assert.equal((await model(d)).orders.filter(o=>o.maintenanceKey?.startsWith('maintenance-test:')).length,1)});
await check('Fehlende Kosten erscheinen nicht als null Euro',async()=>{const d=await fixture(),m=await model(d),c=calculate(m,'o1');assert.equal(c.plannedMaterial,null);assert.equal(c.labor,null)});
await check('Wiederherstellung in getrennter SQLite-Datenbank erhält Tabellen, Revision und Dokumentmetadaten',async()=>{const d=await fixture();await run(d,admin,team());const restored=new DatabaseSync(':memory:');const schema=d.sql.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();restored.exec('PRAGMA foreign_keys=OFF');for(const s of schema)restored.exec(s.sql);const tables=d.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();for(const {name} of tables){const rows=d.sql.prepare('SELECT * FROM '+name).all();for(const row of rows){const keys=Object.keys(row);restored.prepare(`INSERT INTO ${name}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row))}assert.deepEqual(restored.prepare('SELECT * FROM '+name).all(),rows)}restored.exec('PRAGMA foreign_keys=ON');assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(restored.prepare('SELECT count(*) AS n FROM missions').get().n,1)});
writeFileSync('work/operations-test-summary.json',JSON.stringify({passed,checkedAt:new Date().toISOString(),browser:'Nicht durchgeführt: überwachte Vorschau nicht verfügbar',productionDataTouched:false},null,2));
await check('Wartung läuft ohne angemeldeten Benutzer, berücksichtigt Vorlauf und protokolliert Systemakteur',async()=>{
 const d=await fixture();
 await run(d,admin,{action:'save',kind:'maintenance',item:{id:'scheduled',name:'Tor',customer:'c1',nextDue:'2030-01-07',intervalDays:365,leadDays:0}});
 await run(d,admin,{action:'save',kind:'maintenance',item:{id:'later',name:'Später',customer:'c1',nextDue:'2030-01-08',intervalDays:365,leadDays:0}});
 await run(d,admin,{action:'save',kind:'maintenance',item:{id:'disabled',name:'Inaktiv',customer:'c1',nextDue:'2030-01-01',intervalDays:365,leadDays:14,active:false}});
 const now=Date.parse('2030-01-07T06:00:00Z');
 await Promise.all([runMaintenanceJob(d,now),runMaintenanceJob(d,now)]);
 await runMaintenanceJob(d,now);
 const m=await model(d);assert.equal(m.orders.filter(o=>o.maintenanceKey).length,1);
 assert.equal(m.orders.find(o=>o.maintenanceKey).maintenanceKey,'scheduled:2030-01-07');
 assert(m.audit.some(a=>a.actor==='Wartungsautomatik'));
});
await check('Vollsicherung stellt Datenbank und binäre Dokumente gemeinsam isoliert wieder her',async()=>{
 const {restoreBackup}=await import('../scripts/restore-backup.mjs');
 const {mkdtemp,readFile,writeFile}=await import('node:fs/promises');
 const d=await fixture(),objects=new Map();
 for(const [id,bytes] of [['legacy-doc',Buffer.from([0,1,255,30,128])],['new-doc',Buffer.from('Zeichnung äöü')]]){
  const checksum=await crypto.subtle.digest('SHA-256',bytes).then(x=>Buffer.from(x).toString('hex'));
  const key=id==='legacy-doc'?id:id+'-'+checksum;objects.set(key,bytes);
  await d.batch([changeStatement(d,{kind:'documents',item:{id,order:'o1',name:id+'.pdf',mime:'application/pdf',size:bytes.length,...(id==='new-doc'?{storageKey:key,checksum}:{}),version:1}})]);
 }
 const bucket={async get(key){const bytes=objects.get(key);return bytes?{body:new Response(bytes).body}:null;}};
 await assert.rejects(createBackup(d,bucket,worker),e=>e.status===403);
 const payload=await (await createBackup(d,bucket,admin)).text();
 const folder=await mkdtemp('work/restore-test-'),input=folder+'/backup.ndjson';await writeFile(input,payload);
 const result=await restoreBackup(input,folder+'/restored');assert.equal(result.files,2);
 const restored=new DatabaseSync(result.directory+'/database.sqlite');
 for(const {name} of d.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())assert.deepEqual(restored.prepare('SELECT * FROM '+name).all(),d.sql.prepare('SELECT * FROM '+name).all());
 for(const [key,bytes] of objects)assert.deepEqual(await readFile(result.directory+'/files/'+key),bytes);
 restored.close();
 await assert.rejects(restoreBackup(input,folder+'/restored'),/existiert/);
 const lines=payload.trimEnd().split('\n');
 await writeFile(folder+'/truncated.ndjson',lines.slice(0,-1).join('\n'));await assert.rejects(restoreBackup(folder+'/truncated.ndjson',folder+'/truncated'),/unvollständig/);
 const corrupt=JSON.parse(lines[1]);corrupt.base64='AAAA';await writeFile(folder+'/corrupt.ndjson',[lines[0],JSON.stringify(corrupt),...lines.slice(2)].join('\n'));await assert.rejects(restoreBackup(folder+'/corrupt.ndjson',folder+'/corrupt'),/Dateiprüfung/);
 objects.delete('legacy-doc');await assert.rejects((await createBackup(d,bucket,admin)).text(),/Dokument fehlt/);
});
await check('Zeittafel-Einstellungen speichern Reihenfolge und Höhe mit Rechte- und Versionsprüfung',async()=>{
 const d=await fixture();
 const item={rowHeight:280,employeeOrder:['e3','e1']};
 await assert.rejects(run(d,worker,{action:'displaySettings',item}),e=>e.status===403);
 const disposition={...admin2,role:'Arbeitsvorbereitung / Disposition'};
 await d.batch([changeStatement(d,{kind:'users',item:disposition})]);
 await run(d,disposition,{action:'displaySettings',item});
 const settings=(await model(d)).settings.find(x=>x.id==='display');
 assert.equal(settings.rowHeight,280);assert.deepEqual(settings.employeeOrder.slice(0,2),['e3','e1']);assert.equal(settings.employeeOrder.length,5);
 assert.equal((await model(d)).settings.find(x=>x.id==='company').timezone,'Europe/Vienna');
 await assert.rejects(run(d,disposition,{action:'displaySettings',item:{...item,version:settings.version,rowHeight:10}}),/Zeilenhöhe/);
 await assert.rejects(run(d,disposition,{action:'displaySettings',item:{...item,version:settings.version,employeeOrder:['e1','e1']}}),/reihenfolge/i);
 await run(d,disposition,{action:'displaySettings',item:{...settings,rowHeight:320}});
 await assert.rejects(run(d,disposition,{action:'displaySettings',item:settings}),e=>e.status===409);
 const compact=(await model(d)).settings.find(x=>x.id==='display');await assert.rejects(run(d,disposition,{action:'displaySettings',item:{...compact,rowHeight:99}}),/Zeilenhöhe/);await run(d,disposition,{action:'displaySettings',item:{...compact,rowHeight:100}});assert.equal((await model(d)).settings.find(x=>x.id==='display').rowHeight,100);
});
writeFileSync('work/operations-test-summary.json',JSON.stringify({passed,checkedAt:new Date().toISOString(),browser:'Blockiert: Vorschau-Dienst nicht verfügbar',productionDataTouched:false},null,2));

test('Auftragsstatus wird gespeichert, konkurrierende Änderungen und ungültige Status werden abgelehnt',async()=>{
 const d=await fixture();let m=await model(d);const o=m.orders.find(o=>o.id==='o1');
 await run(d,admin,{action:'save',kind:'orders',item:{...o,accountingStatus:'Rechnung bezahlt'}});
 assert.equal((await model(d)).orders.find(o=>o.id==='o1').accountingStatus,'Rechnung bezahlt');
 await assert.rejects(()=>run(d,admin,{action:'save',kind:'orders',item:{...o,accountingStatus:'In Arbeit'}}));
 m=await model(d);await assert.rejects(()=>run(d,admin,{action:'save',kind:'orders',item:{...m.orders.find(o=>o.id==='o1'),accountingStatus:'Erfunden'}}));
});

test('Aufwandspositionen speichern atomar und berechnen Material, Dauer, Zuschläge und Maschinen',async()=>{
 const d=await fixture(),m=await model(d),o=m.orders.find(o=>o.id==='o1');
 const ledger={materials:[{id:'lm1',date:'2030-01-07',name:'Blech 12 mm',unit:'m²',price:161.49,quantity:1.5,discount:0},{id:'lm2',date:'2030-01-07',name:'Blech 35 mm',unit:'m²',price:537,quantity:1.5,discount:0}],labor:[{id:'lt1',date:'2030-01-07',name:'Martin Huber',employee:'e1',duration:'06:30',rate:70,surcharge50:1,surcharge100:0}],machines:[{id:'lmc1',date:'2030-01-07',name:'Plasma',duration:'01:00',rate:30,surcharge50:0,surcharge100:0}],other:[{id:'lo1',date:'2030-01-07',name:'Transport',price:50}]};
 await run(d,admin,{action:'orderLedger',item:{order:o.id,version:o.version,ledger}});
 const updated=await model(d),c=calculate(updated,o.id);assert.equal(c.ledger.materials,1047.74);assert.equal(c.ledger.labor,682.5);assert.equal(c.ledger.machines,30);assert.equal(c.ledger.other,50);assert.equal(c.ledger.hours,6.5);assert.equal(c.ledger.total,1810.24);
 await assert.rejects(()=>run(d,admin,{action:'orderLedger',item:{order:o.id,version:o.version,ledger}}));
 const current=updated.orders.find(x=>x.id===o.id);const broken=structuredClone(ledger);broken.labor[0].duration='01:70';
 await assert.rejects(()=>run(d,admin,{action:'orderLedger',item:{order:o.id,version:current.version,ledger:broken}}));
 assert.deepEqual((await model(d)).orders.find(x=>x.id===o.id).ledger,updated.orders.find(x=>x.id===o.id).ledger);
});
test('Aufwandsbearbeitung benötigt Finanzrecht und Preise werden nicht an Mitarbeiter übertragen',async()=>{
 const d=await fixture(),m=await model(d),o=m.orders.find(o=>o.id==='o1');const ledger={materials:[],labor:[],machines:[],other:[{id:'l1',date:'2030-01-07',name:'Transport',price:50}]};
 await assert.rejects(()=>run(d,worker,{action:'orderLedger',item:{order:o.id,version:o.version,ledger}}));
 const office={...admin,id:'office',role:'Büro'};await assert.rejects(()=>run(d,office,{action:'orderLedger',item:{order:o.id,version:o.version,ledger}}));
 await run(d,admin,{action:'orderLedger',item:{order:o.id,version:o.version,ledger}});
 const pub=publicModel(await model(d),worker);assert(!JSON.stringify(pub).includes('"price"'));assert.equal(pub.calculations.length,0);
 const next=(await model(d)).orders.find(x=>x.id===o.id);await run(d,admin,{action:'save',kind:'orders',item:{...next,ledger:{materials:[],labor:[],machines:[],other:[]},title:'Neuer Titel'}});assert.equal((await model(d)).orders.find(x=>x.id===o.id).ledger.other.length,1);
});

test('Auftrags-Dauerzeiten fließen in Nachkalkulation ein und werden gemäß Zeitrechten gefiltert',async()=>{
 const d=await fixture(),m=await model(d),o=m.orders.find(x=>x.id==='o1');const ledger={materials:[],machines:[],other:[],labor:[{id:'rep1',employee:'e1',name:'Martin Huber',date:'2030-01-07',duration:'06:30',rate:70,surcharge50:0,surcharge100:0},{id:'rep2',employee:'e2',name:'Thomas Berger',date:'2030-01-07',duration:'02:00',rate:70,surcharge50:0,surcharge100:0}]};
 const before=calculate(m,o.id).actualHours;await run(d,admin,{action:'orderLedger',item:{order:o.id,version:o.version,ledger}});const updated=await model(d);assert.equal(calculate(updated,o.id).actualHours,before+8.5);const pub=publicModel(updated,worker);assert.equal(pub.orders.find(x=>x.id===o.id).ledger.labor.length,1);assert.equal(pub.orders.find(x=>x.id===o.id).ledger.labor[0].employee,'e1');
});

test('Urlaub und Krankenstand speichern für einen Zeitraum und erlauben Bearbeitung',async()=>{
 const d=await fixture();await run(d,admin,{action:'save',kind:'absences',item:{id:'urlaub-test',employee:'e1',date:'2030-01-07',end:'2030-01-09',type:'Urlaub'}});const a=(await model(d)).absences.find(a=>a.id==='urlaub-test');assert.equal(a.end,'2030-01-09');await run(d,admin,{action:'save',kind:'absences',item:{...a,type:'Krankenstand'}});assert.equal((await model(d)).absences.find(x=>x.id==='urlaub-test').type,'Krankenstand');
});
test('Abwesenheiten prüfen Datum, Überschneidung, Einsatzkonflikte und Berechtigung',async()=>{
 const d=await fixture();const item={id:'absence-test',employee:'e1',date:'2030-01-07',end:'2030-01-09',type:'Krankenstand'};for(const change of [{date:''},{date:'2030-02-30',end:'2030-03-01'},{end:'2030-01-06'},{type:'Erfunden'}])await assert.rejects(()=>run(d,admin,{action:'save',kind:'absences',item:{...item,...change}}));await assert.rejects(()=>run(d,worker,{action:'save',kind:'absences',item}));await run(d,admin,{action:'save',kind:'absences',item});await assert.rejects(()=>run(d,admin,{action:'save',kind:'absences',item:{...item,id:'overlap',date:'2030-01-09',end:'2030-01-10',type:'Urlaub'}}));
 const d2=await fixture();await run(d2,admin,team());const conflict=await run(d2,admin,{action:'save',kind:'absences',item});assert(conflict.notices.some(s=>s.includes('abwesend')));assert((await model(d2)).absences.some(a=>a.id===item.id));
});

test('Artikel- und CRM-Import sind atomar, erhalten Lagerbestand und prüfen Versionsstände',async()=>{
 const d=await fixture();let m=await model(d);const r=m.inventory[0];await run(d,admin,{action:'masterImport',kind:'inventory',item:{rows:[{...r,stock:999,name:'Geändert',priceGroup:'Stahl',weightKg:12.5,properties:[{label:'Werkstoff',value:'S235',unit:''}]}]}});m=await model(d);assert.equal(m.inventory.find(x=>x.id===r.id).stock,r.stock);assert.equal(m.inventory.find(x=>x.id===r.id).weightKg,12.5);
 await assert.rejects(()=>run(d,admin,{action:'masterImport',kind:'inventory',item:{rows:[{...r,name:'Veraltet'}]}}));
 const current=m.inventory.find(x=>x.id===r.id);await assert.rejects(()=>run(d,admin,{action:'masterImport',kind:'inventory',item:{rows:[{...current,name:'Nicht übernehmen'},{id:'new-invalid',name:'',article:'bad'}]}}));assert.equal((await model(d)).inventory.find(x=>x.id===r.id).name,'Geändert');
 const c=m.customers[0];await run(d,admin,{action:'masterImport',kind:'customers',item:{rows:[{...c,number:'C100',properties:[{label:'Branche',value:'Metall',unit:''}]},{id:'new-customer',name:'Neu',number:'C101'}]}});assert.equal((await model(d)).customers.find(x=>x.id===c.id).properties[0].value,'Metall');assert((await model(d)).customers.some(x=>x.id==='new-customer'));
});
test('Preisgruppenänderung verändert nur gewählte Artikel und schützt Vorschau, Rechte und bestehende Positionen',async()=>{
 const d=await fixture();let m=await model(d);const r=m.inventory[0];await run(d,admin,{action:'save',kind:'inventory',item:{...r,price:100,priceGroup:'Stahl'}});m=await model(d);const current=m.inventory.find(x=>x.id===r.id);const cmd={action:'priceGroup',item:{group:'Stahl',percent:10,items:[{id:current.id,version:current.version}]}};const ledgerBefore=structuredClone(m.orders);await assert.rejects(()=>run(d,worker,cmd));await run(d,admin,cmd);const result=await model(d);assert.equal(result.inventory.find(x=>x.id===r.id).price,110);assert.deepEqual(result.orders,ledgerBefore);await assert.rejects(()=>run(d,admin,cmd));
 const office={...admin,id:'office-master',email:'office-master@test.invalid',role:'Büro'};await d.batch([changeStatement(d,{kind:'users',item:office})]);const newer=result.inventory.find(x=>x.id===r.id);await assert.rejects(()=>run(d,office,{action:'masterImport',kind:'inventory',item:{rows:[{...newer,price:null}]}}));await assert.rejects(()=>run(d,office,{action:'save',kind:'inventory',item:{...newer,price:null}}));
});

test('Wochen-Sollstunden dürfen überschritten werden und Verschieben in Kollision bleibt möglich',async()=>{
 const d=await fixture();let result;for(const date of ['2030-01-07','2030-01-08','2030-01-09','2030-01-10','2030-01-11'])result=await run(d,admin,team(date,{end:'18:00',members:[{employee:'e1'}]}));assert(result.notices.some(s=>s.includes('Sollstunden überschritten')&&s.includes('50')));await run(d,admin,team('2030-01-08',{end:'12:00',members:[{employee:'e2'}]}));const a=(await model(d)).assignments.find(a=>a.date==='2030-01-07'&&a.employee==='e1');const moved=await run(d,admin,{action:'move',item:{...a,date:'2030-01-08',employee:'e2',start:'08:00',scope:'single'}});assert(moved.notices.some(s=>s.includes('Doppelbelegung')));assert.equal((await model(d)).assignments.find(x=>x.id===a.id).employee,'e2');
});

test('Kollisionsfreigabe erlaubt keine veraltete Änderung desselben Einsatzes',async()=>{
 const d=await fixture();await run(d,admin,team());const a=(await model(d)).assignments.find(a=>a.date===monday&&a.employee==='e1');await run(d,admin,{action:'move',item:{...a,date:'2030-01-08',start:'08:00',scope:'single'}});await assert.rejects(()=>run(d,admin2,{action:'move',item:{...a,date:'2030-01-09',start:'08:00',scope:'single'}}),e=>e.status===409);assert.equal((await model(d)).assignments.find(x=>x.id===a.id).date,'2030-01-08');
});
await check('Einteilung löschen erhält Team, Auftrag, gebuchte Zeiten und Rückmeldungen',async()=>{
 const d=await fixture();await run(d,admin,team());let m=await model(d),a=m.assignments.find(a=>a.date===monday&&a.employee==='e1');
 await run(d,worker,{action:'time',item:{employee:'e1',order:'o1',date:monday,endDate:monday,start:'07:00',end:'08:00',type:'Produktion'}});
 await run(d,worker,{action:'feedback',item:{assignment:a.id,status:'Arbeit abgeschlossen',notes:'Erledigt',consumption:[]}});
 m=await model(d);a=m.assignments.find(b=>b.id===a.id);const before=structuredClone(m);
 const command={action:'deleteAssignment',item:{id:a.id,version:a.version}},key=crypto.randomUUID();await run(d,admin,command,key);const repeated=await run(d,admin,command,key);assert(repeated.repeated);
 m=await model(d);assert(m.assignments.find(b=>b.id===a.id).cancelled);assert.equal(m.assignments.find(b=>b.id===a.id).version,a.version+1);
 assert(!m.assignments.find(b=>b.mission===a.mission&&b.employee==='e2').cancelled);assert(!m.missions.find(b=>b.id===a.mission).cancelled);
 assert.deepEqual(m.orders,before.orders);assert.deepEqual(m.times,before.times);assert.deepEqual(m.feedback,before.feedback);
 assert(!publicModel(m,admin).assignments.some(b=>b.id===a.id));assert(m.audit.some(b=>b.entity_id===a.id||JSON.stringify(b).includes(a.id)));assert.equal(d.sql.prepare('PRAGMA foreign_key_check').all().length,0);
 const remaining=m.assignments.find(b=>b.mission===a.mission&&!b.cancelled);await run(d,admin,{action:'move',item:{...remaining,date:'2030-01-08',scope:'team'}});
 m=await model(d);assert.equal(m.assignments.find(b=>b.id===a.id).date,monday);assert.equal(m.assignments.find(b=>b.id===remaining.id).date,'2030-01-08');
 await run(d,admin,{action:'deleteAssignment',item:m.assignments.find(b=>b.id===remaining.id)});m=await model(d);assert(m.missions.find(b=>b.id===a.mission).cancelled);assert(!publicModel(m,admin).missions.some(b=>b.id===a.mission));
});
await check('Planung löschen prüft Rechte und veraltete Einträge',async()=>{
 const d=await fixture();await run(d,admin,team());let a=(await model(d)).assignments.find(a=>a.date===monday);
 await assert.rejects(run(d,worker,{action:'deleteAssignment',item:a}),e=>e.status===403);
 await run(d,admin,{action:'move',item:{...a,date:'2030-01-08',scope:'single'}});
 await assert.rejects(run(d,admin,{action:'deleteAssignment',item:a}),e=>e.status===409);
 a=(await model(d)).assignments.find(b=>b.id===a.id);await run(d,admin,{action:'deleteAssignment',item:a});a=(await model(d)).assignments.find(b=>b.id===a.id);
 await assert.rejects(run(d,admin,{action:'move',item:{...a,date:monday}}),e=>e.status===409);
});
await check('Urlaub und Krankenstand löschen ermöglicht neue Abwesenheit im selben Zeitraum',async()=>{
 const d=await fixture();for(const type of ['Urlaub','Krankenstand']){
 await run(d,admin,{action:'save',kind:'absences',item:{employee:'e1',date:monday,end:'2030-01-09',type}});
 let a=(await model(d)).absences.find(a=>a.date===monday&&!a.cancelled);
 await assert.rejects(run(d,worker,{action:'deleteAbsence',item:a}),e=>e.status===403);
 await assert.rejects(run(d,admin,{action:'deleteAbsence',item:{...a,version:a.version-1}}),e=>e.status===409);
 await run(d,admin,{action:'deleteAbsence',item:a});assert(!publicModel(await model(d),admin).absences.some(b=>b.id===a.id));
 a=(await model(d)).absences.find(b=>b.id===a.id);await assert.rejects(run(d,admin,{action:'save',kind:'absences',item:a}),e=>e.status===409);
 }
 const r=await run(d,admin,team());assert(!r.notices.some(s=>s.includes('abwesend')));
});
await check('Mehrtageseinsatz zählt Tageszeit mit Mittagspause und lässt Abende kollisionsfrei',async()=>{
 const d=await fixture();await run(d,admin,{action:'save',kind:'resources',item:{id:'daily-resource',name:'Maschine',type:'Maschine',active:true}});
 await run(d,admin,team(monday,{endDate:'2030-01-09',start:'07:00',end:'18:00',members:[{employee:'e1'}],resources:['daily-resource']}));
 let m=await model(d),a=m.assignments.find(a=>a.date===monday);const {planningNeed}=await import('../work/operations-test-bundle.mjs');
 const baseline=planningNeed({...m,assignments:m.assignments.filter(b=>b.id!==a.id)},m.orders.find(o=>o.id==='o1')).planned;assert.equal(planningNeed(m,m.orders.find(o=>o.id==='o1')).planned-baseline,30);
 const result=await run(d,admin,team('2030-01-08',{start:'19:00',end:'20:00',members:[{employee:'e1'}],resources:['daily-resource']}));assert(!result.notices.some(s=>s.includes('Doppelbelegung')||s.includes('Ressource bereits belegt')));
 await run(d,admin,{action:'move',item:{...a,date:'2030-01-14',start:'08:00',scope:'single'}});m=await model(d);a=m.assignments.find(b=>b.id===a.id);assert.equal(a.endDate,'2030-01-16');assert.equal(a.start,'08:00');assert.equal(a.end,'19:00');
 assert.equal(planningNeed({...m,assignments:[a]},m.orders.find(o=>o.id==='o1')).planned,30);
});
await check('Mehrtageseinsatz verschieben über Sommerzeit erhält tägliche Ortszeiten und Nettostunden',async()=>{
 const d=await fixture();await run(d,admin,team('2030-03-23',{endDate:'2030-03-25',start:'07:00',end:'18:00',members:[{employee:'e1'}]}));let a=(await model(d)).assignments.find(a=>a.date==='2030-03-23');await run(d,admin,{action:'move',item:{...a,date:'2030-03-30',start:'07:00',scope:'single'}});a=(await model(d)).assignments.find(b=>b.id===a.id);assert.equal(a.endDate,'2030-04-01');assert.equal(a.end,'18:00');const {planningNeed}=await import('../work/operations-test-bundle.mjs');assert.equal(planningNeed({...(await model(d)),assignments:[a]}, {id:'o1',hours:40}).planned,30);
});

await check('Kalender-Einplanen speichert den angeklickten vergangenen und zukünftigen Tag als eintägigen Einsatz',async()=>{
 const {teamForm,changeTeamDate}=await import('../work/operations-test-bundle.mjs');
 const d=await fixture(),today='2030-01-07';
 for(const day of ['2029-12-20','2030-01-15']){
  const f=teamForm({employee:'e1',date:day,start:'07:00',end:'16:00',order:'o1'},today);
  assert.equal(f.endDate,day);await run(d,admin,{action:'team',item:f});
  const a=(await model(d)).assignments.find(a=>a.employee==='e1'&&a.date===day);assert(a);assert.equal(a.endDate,day);
 }
 let f=teamForm({employee:'e2',order:'o1'},today);f=changeTeamDate(f,'2030-01-21');assert.equal(f.endDate,'2030-01-21');await run(d,admin,{action:'team',item:f});assert((await model(d)).assignments.some(a=>a.date==='2030-01-21'&&a.endDate===a.date&&a.employee==='e2'));
 f=changeTeamDate({...f,endDate:'2030-01-25'},'2030-01-22');assert.equal(f.endDate,'2030-01-25');f=changeTeamDate(f,'2030-01-28');assert.equal(f.endDate,'2030-01-28');
});
await check('Standardpausen werden gespeichert, bleiben bei Verschieben erhalten und können abgewählt werden',async()=>{
 const {teamForm,planningNeed}=await import('../work/operations-test-bundle.mjs');const d=await fixture(),f=teamForm({employee:'e1',order:'o1',date:monday,endDate:'2030-01-09'},monday);assert.equal(f.start,'07:30');assert.equal(f.end,'17:00');assert.equal(f.morningBreak,true);assert.equal(f.afternoonBreak,true);
 await run(d,admin,{action:'team',item:f});let m=await model(d),a=m.assignments.find(a=>a.date===monday);assert.equal(a.morningBreak,true);assert.equal(a.afternoonBreak,true);assert.equal(planningNeed({...m,assignments:[a]}, {id:'o1',hours:50}).planned,24);const beforeTimes=structuredClone(m.times);
 await run(d,admin,{action:'move',item:{id:a.id,version:a.version,date:'2030-01-14',start:'07:30'}});m=await model(d);a=m.assignments.find(b=>b.id===a.id);assert.equal(a.morningBreak,true);assert.equal(a.afternoonBreak,true);
 await run(d,admin,{action:'move',item:{...a,morningBreak:false}});m=await model(d);a=m.assignments.find(b=>b.id===a.id);assert.equal(planningNeed({...m,assignments:[a]}, {id:'o1',hours:50}).planned,24.75);
 await run(d,admin,{action:'move',item:{...a,afternoonBreak:false}});m=await model(d);a=m.assignments.find(b=>b.id===a.id);assert.equal(planningNeed({...m,assignments:[a]}, {id:'o1',hours:50}).planned,25.5);assert.deepEqual(m.times,beforeTimes);
 await assert.rejects(run(d,admin,{action:'move',item:{...a,morningBreak:'false'}}),/Pauseneinstellung/);
});
await check('Mehrtageseinteilung: nur gewählter Tag entfällt, Stunden und Team bleiben korrekt',async()=>{
 const {planningNeed}=await import('../work/operations-test-bundle.mjs');const d=await fixture();await run(d,admin,team(monday,{endDate:'2030-01-09',start:'07:30',end:'17:00',morningBreak:true,afternoonBreak:true}));let m=await model(d),a=m.assignments.find(a=>a.date===monday&&a.employee==='e1');const before=structuredClone(m),key=crypto.randomUUID(),command={action:'deleteAssignment',item:{id:a.id,version:a.version,scope:'day',deleteDay:'2030-01-08'}};
 await run(d,admin,command,key);assert((await run(d,admin,command,key)).repeated);m=await model(d);a=m.assignments.find(b=>b.id===a.id);assert.deepEqual(a.excludedDates,['2030-01-08']);assert(!a.cancelled);assert.equal(planningNeed({...m,assignments:[a]}, {id:'o1',hours:40}).planned,16);assert(!m.assignments.find(b=>b.mission===a.mission&&b.employee==='e2').excludedDates?.length);assert(!m.missions.find(b=>b.id===a.mission).cancelled);assert.deepEqual(m.orders,before.orders);assert.deepEqual(m.times,before.times);
 await assert.rejects(run(d,admin,command),e=>e.status===409);await assert.rejects(run(d,admin,{action:'deleteAssignment',item:{...a,scope:'day',deleteDay:'2030-01-10'}}),e=>e.status===409);
 await assert.rejects(run(d,admin,{action:'deleteAssignment',item:{...a,scope:'day',deleteDay:'2030-02-30'}}),e=>e.status===400);
 await run(d,admin,{action:'move',item:{...a,date:'2030-01-14',scope:'single'}});m=await model(d);a=m.assignments.find(b=>b.id===a.id);assert.deepEqual(a.excludedDates,['2030-01-15']);assert.equal(planningNeed({...m,assignments:[a]}, {id:'o1',hours:40}).planned,16);
 await run(d,admin,{action:'deleteAssignment',item:{...a,scope:'all'}});assert((await model(d)).assignments.find(b=>b.id===a.id).cancelled);
});
await check('Tageslöschung gibt Ressourcen frei und beendet einen Einsatz erst nach dem letzten Tag',async()=>{
 const d=await fixture();await run(d,admin,{action:'save',kind:'resources',item:{id:'day-delete-resource',name:'Gerät',type:'Gerät',active:true}});await run(d,admin,team(monday,{endDate:'2030-01-08',members:[{employee:'e1'}],resources:['day-delete-resource']}));let a=(await model(d)).assignments.find(a=>a.date===monday);
 await run(d,admin,{action:'deleteAssignment',item:{...a,scope:'day',deleteDay:'2030-01-08'}});const result=await run(d,admin,team('2030-01-08',{members:[{employee:'e1'}],resources:['day-delete-resource']}));assert(!result.notices.some(s=>s.includes('Doppelbelegung')||s.includes('Ressource bereits belegt')));
 a=(await model(d)).assignments.find(b=>b.id===a.id);await run(d,admin,{action:'deleteAssignment',item:{...a,scope:'day',deleteDay:monday}});const m=await model(d);assert(m.assignments.find(b=>b.id===a.id).cancelled);assert(m.missions.find(b=>b.id===a.mission).cancelled);
});
await check('Urlaub, Schulung und Krankenstand können an einem einzelnen Tag gelöscht werden',async()=>{
 const d=await fixture();for(const [index,type] of ['Urlaub','Schulung','Krankenstand'].entries()){
 const date='2030-01-'+String(7+index*7).padStart(2,'0'),middle='2030-01-'+String(8+index*7).padStart(2,'0'),end='2030-01-'+String(9+index*7).padStart(2,'0');await run(d,admin,{action:'save',kind:'absences',item:{employee:'e1',date,end,type}});let a=(await model(d)).absences.find(a=>a.date===date);
 await assert.rejects(run(d,worker,{action:'deleteAbsence',item:{...a,scope:'day',deleteDay:middle}}),e=>e.status===403);await run(d,admin,{action:'deleteAbsence',item:{...a,scope:'day',deleteDay:middle}});a=(await model(d)).absences.find(b=>b.id===a.id);assert.deepEqual(a.excludedDates,[middle]);assert(!a.cancelled);
 await run(d,admin,{action:'save',kind:'absences',item:{employee:'e1',date:middle,end:middle,type:'Schulung'}});await assert.rejects(run(d,admin,{action:'save',kind:'absences',item:{employee:'e1',date,end:date,type:'Urlaub'}}),/Abwesenheit/);await run(d,admin,{action:'deleteAbsence',item:{...a,scope:'all'}});assert((await model(d)).absences.find(b=>b.id===a.id).cancelled);
 }
});

await check('Buchung aus Planung erfasst Zeit und Material am gewählten Tag für bestehenden und neuen Auftrag',async()=>{
 const {createLedgerRow,blankLedger}=await import('../work/operations-test-bundle.mjs');const d=await fixture(),context={date:'2030-02-15',employee:'e2'};
 await run(d,admin,{action:'save',kind:'orders',item:{id:'booking-order',title:'Neuer Auftrag aus Planung',customer:'c1',type:'Produktion',status:'Auftrag bestätigt',accountingStatus:'In Arbeit',start:context.date,end:context.date,hours:8,responsible:context.employee}});
 for(const orderId of ['o1','booking-order']){let m=await model(d),order=m.orders.find(o=>o.id===orderId),ledger=structuredClone(order.ledger||blankLedger());const labor=createLedgerRow('labor',m.employees,context,crypto.randomUUID()),material=createLedgerRow('materials',m.employees,context,crypto.randomUUID());labor.duration='02:30';Object.assign(material,{name:'Stahlblech',quantity:2,price:12.5});ledger.labor.push(labor);ledger.materials.push(material);
 const beforeTimes=structuredClone(m.times),beforeAssignments=structuredClone(m.assignments);await run(d,admin,{action:'orderLedger',item:{order:orderId,version:order.version,ledger}});m=await model(d);order=m.orders.find(o=>o.id===orderId);assert.equal(order.ledger.labor.at(-1).employee,'e2');assert.equal(order.ledger.labor.at(-1).date,context.date);assert.equal(order.ledger.materials.at(-1).date,context.date);assert.equal(order.ledger.materials.at(-1).quantity,2);assert.deepEqual(m.times,beforeTimes);assert.deepEqual(m.assignments,beforeAssignments);assert.equal(calculate(m,orderId).ledger.hours,2.5);
 }
});
await check('Kundenstundensatz wird gespeichert, neue Zeilen übernehmen ihn und alte bleiben erhalten',async()=>{
 const {createLedgerRow,blankLedger,laborHourlyRate}=await import('../work/operations-test-bundle.mjs');const d=await fixture();let m=await model(d),c=m.customers[0];
 const bureau={id:'office',role:'Büro',overrides:'{}'};
 await assert.rejects(run(d,bureau,{action:'save',kind:'customers',item:{...c,hourlyRate:85.5}}),e=>e.status===403);
 await run(d,admin,{action:'save',kind:'customers',item:{...c,hourlyRate:85.5}});m=await model(d);c=m.customers.find(x=>x.id===c.id);assert.equal(c.hourlyRate,85.5);assert.equal(publicModel(m,bureau).customers.find(x=>x.id===c.id).hourlyRate,undefined);
 const context={date:'2030-02-15',employee:m.employees[0].id,customer:c};const row=createLedgerRow('labor',m.employees,context,crypto.randomUUID());assert.equal(row.rate,85.5);assert.equal(laborHourlyRate(c,{hourlyRate:120}),85.5);assert.equal(laborHourlyRate({hourlyRate:0},{hourlyRate:120}),0);assert.equal(laborHourlyRate({hourlyRate:null},{hourlyRate:120}),120);
 const order=m.orders.find(o=>o.customer===c.id),ledger=blankLedger();ledger.labor.push(row);await run(d,admin,{action:'orderLedger',item:{order:order.id,version:order.version,ledger}});
 await assert.rejects(run(d,bureau,{action:'masterImport',kind:'customers',item:{rows:[{...c,hourlyRate:null}]}}),e=>e.status===403);
 await run(d,admin,{action:'save',kind:'customers',item:{...c,hourlyRate:99}});m=await model(d);assert.equal(m.orders.find(o=>o.id===order.id).ledger.labor[0].rate,85.5);c=m.customers.find(x=>x.id===c.id);
 await run(d,admin,{action:'save',kind:'customers',item:{...c,hourlyRate:null}});assert.equal((await model(d)).customers.find(x=>x.id===c.id).hourlyRate,null);
});
await check('Kundensperre und Archiv sind reversibel, blockieren neue Aufträge und Planung und erhalten Altdaten',async()=>{
 const {blankLedger}=await import('../work/operations-test-bundle.mjs');const d=await fixture();let m=await model(d);const order=m.orders[0],customerId=order.customer;const original={orders:m.orders.length,assignments:m.assignments.length,times:m.times.length};
 for(const customerStatus of ['Gesperrt','Archiviert']){
 let c=(await model(d)).customers.find(c=>c.id===customerId);await run(d,admin,{action:'save',kind:'customers',item:{...c,customerStatus,statusReason:'Test'}});
 await assert.rejects(run(d,admin,{action:'save',kind:'orders',item:{id:'blocked-'+customerStatus,customer:customerId,title:'Neu'}}),/Kunde ist/);
 await assert.rejects(run(d,admin,{action:'fromTemplate',item:{customer:customerId,template:(await model(d)).templates[0].id,date:'2030-01-15'}}),/Kunde ist/);
 await assert.rejects(run(d,admin,{action:'team',item:{order:order.id,members:[{employee:'e1'}],date:'2030-01-15',start:'07:30',end:'17:00'}}),/Kunde ist/);
 m=await model(d);let o=m.orders.find(o=>o.id===order.id);await run(d,admin,{action:'save',kind:'orders',item:{...o,notes:'Abschluss weiterhin möglich'}});m=await model(d);o=m.orders.find(o=>o.id===order.id);await run(d,admin,{action:'orderLedger',item:{order:o.id,version:o.version,ledger:o.ledger||blankLedger()}});
 const visible=publicModel(await model(d),admin);assert(visible.customers.some(c=>c.id===customerId));assert(visible.orders.some(o=>o.id===order.id));assert.equal(visible.orders.length,original.orders);assert.equal(visible.assignments.length,original.assignments);assert.equal(visible.times.length,original.times);
 }
 let c=(await model(d)).customers.find(c=>c.id===customerId);await assert.rejects(run(d,worker,{action:'save',kind:'customers',item:{...c,customerStatus:'Aktiv'}}),e=>e.status===403);
 await run(d,admin,{action:'save',kind:'customers',item:{...c,customerStatus:'Aktiv'}});await run(d,admin,{action:'save',kind:'orders',item:{id:'reactivated-order',customer:customerId,title:'Nach Reaktivierung'}});assert((await model(d)).orders.some(o=>o.id==='reactivated-order'));
});
await check('Automatische Wartungen überspringen gesperrte Kunden und laufen nach Reaktivierung weiter',async()=>{
 const d=await fixture();let m=await model(d),c=m.customers[0];await run(d,admin,{action:'save',kind:'maintenance',item:{id:'status-maintenance',name:'Prüfung',customer:c.id,nextDue:'2030-01-15',intervalDays:365,hours:1}});
 await run(d,admin,{action:'save',kind:'customers',item:{...c,customerStatus:'Gesperrt'}});const p=(await model(d)).maintenance.find(p=>p.id==='status-maintenance');await assert.rejects(run(d,admin,{action:'generateMaintenance',item:{id:p.id}}),/Kunde ist/);
 const result=await runMaintenanceJob(d,Date.parse('2030-01-15T12:00:00Z'));assert.equal(result.generated,0);assert.equal((await model(d)).maintenance.find(x=>x.id===p.id).nextDue,'2030-01-15');
 c=(await model(d)).customers.find(x=>x.id===c.id);await run(d,admin,{action:'save',kind:'customers',item:{...c,customerStatus:'Aktiv'}});assert.equal((await runMaintenanceJob(d,Date.parse('2030-01-15T12:00:00Z'))).generated,1);
});
