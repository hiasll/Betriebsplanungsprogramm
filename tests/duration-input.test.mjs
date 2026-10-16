import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/order-ledger.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/duration-input.mjs'});
const {normalizeDuration,durationHours,validateLedger,blankLedger,ledgerTotals}=await import('../work/duration-input.mjs');
test('Stunden, Dezimalstunden und hh:mm werden minutengenau vereinheitlicht',()=>{
 for(const [input,expected] of [['8','08:00'],['8,5','08:30'],['8.5','08:30'],['0,25','00:15'],['1,75','01:45'],[' 8,5 ','08:30'],['2:30','02:30'],['02:30','02:30'],['1,3333','01:20'],['0','00:00']])assert.equal(normalizeDuration(input),expected);
 for(const input of ['8:60','-1','8,5h','1,2,3','','1e2','10000','9999,999'])assert(Number.isNaN(durationHours(input)),input);
});
test('Arbeits- und Maschinenzeiten speichern Dezimalstunden kanonisch und rechnen korrekt',()=>{
 const ledger=blankLedger();for(const kind of ['labor','machines'])ledger[kind].push({id:kind,date:'2030-01-15',name:'Test',employee:'e1',duration:'8,5',rate:60});
 const saved=validateLedger(ledger,[{id:'e1'}]);assert.equal(saved.labor[0].duration,'08:30');assert.equal(saved.machines[0].duration,'08:30');assert.equal(ledgerTotals(saved).hours,8.5);assert.equal(ledgerTotals(saved).total,1020);assert.equal(ledgerTotals(ledger).total,1020);
 ledger.labor[0].duration='0';assert.throws(()=>validateLedger(ledger,[{id:'e1'}]),/Zeit bitte/);
});
