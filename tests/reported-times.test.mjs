import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('work',{recursive:true});
await build({entryPoints:['lib/reported-times.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/reported-times-test.mjs'});
const {reportedTimeEntries:entries,reportedMachineEntries:machines,employeeTimeSummary:summary}=await import('../work/reported-times-test.mjs');
const d={settings:[{id:'company',timezone:'Europe/Vienna'}],times:[{id:'t1',employee:'e1',order:'o1',date:'2030-01-07',start:'07:00',end:'09:00',type:'Produktion'},{id:'pause',employee:'e1',order:'o1',date:'2030-01-07',start:'09:00',end:'09:30',type:'Pause'}],orders:[{id:'o1',type:'Produktion',ledger:{labor:[{id:'r1',employee:'e1',date:'2030-01-07',duration:'06:30'},{id:'r2',employee:'e2',date:'2030-01-12',duration:'02:00'}],machines:[{id:'m1',name:'Plasma',date:'2030-01-07',duration:'01:00'}]}},{id:'o2',type:'Reparatur',ledger:{labor:[{id:'r1',employee:'e1',date:'2030-01-08',duration:'01:00'}]}}]};
test('gespeicherte Dauerzeilen ergänzen Zeitbuchungen genau einmal, ohne fiktive Startzeiten',()=>{const rows=entries(d);assert.equal(rows.length,5);assert.equal(new Set(rows.map(r=>r.id)).size,5);const r=rows.find(r=>r.source==='Auftrag');assert.equal(r.hours,6.5);assert.equal(r.start,undefined);assert.equal(entries(d).length,5)});
test('Ist-Summen berücksichtigen Mitarbeiter, Datum und Auftrag; Pausen bleiben ausgeschlossen',()=>{const s=summary(entries(d),'e1',['2030-01-07']);assert.equal(s.total,8.5);assert.equal(s.fromOrders,6.5);assert.equal(s.production,8.5);assert.equal(summary(entries(d),'e2',['2030-01-12']).total,2);assert.equal(summary(entries(d),'e1',['2030-01-08']).service,1)});
test('Ändern und Löschen von Auftragszeilen aktualisiert die Auswertung ohne Kopien',()=>{const x=structuredClone(d);x.orders[0].ledger.labor[0].duration='03:00';assert.equal(summary(entries(x),'e1',['2030-01-07']).total,5);x.orders[0].ledger.labor=[];assert.equal(summary(entries(x),'e1',['2030-01-07']).total,2)});
test('Maschinenzeiten werden separat ausgewertet und gehören nicht in Mitarbeiter-Ist',()=>{assert.equal(machines(d).length,1);assert.equal(machines(d)[0].hours,1);assert.equal(summary(entries(d),'e1',['2030-01-07']).total,8.5)});

test('Ladezustand ohne Daten verursacht keine Ausnahme',()=>{for(const data of [null,undefined,{}]){assert.deepEqual(entries(data),[]);assert.deepEqual(machines(data),[])}});
