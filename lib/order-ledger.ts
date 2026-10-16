export const ledgerKinds=['materials','labor','machines','other'] as const;
export type LedgerKind=typeof ledgerKinds[number];
export type Ledger=Record<LedgerKind,any[]>;
export const blankLedger=():Ledger=>({materials:[],labor:[],machines:[],other:[]});
export function normalizeDuration(value:string){
 const text=String(value??'').trim();
 if(/^\d{1,4}:[0-5]\d$/.test(text)){const [h,m]=text.split(':');return String(Number(h)).padStart(2,'0')+':'+m}
 if(!/^\d{1,4}(?:[.,]\d+)?$/.test(text))return text;
 const minutes=Math.round(Number(text.replace(',','.'))*60);
 if(!Number.isFinite(minutes)||minutes>599999)return text;
 return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}
export function durationHours(value:string){value=normalizeDuration(value);if(!/^\d{1,4}:[0-5]\d$/.test(value||''))return NaN;const [h,m]=value.split(':').map(Number);return h+m/60}
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function ledgerLineTotal(kind:LedgerKind,row:any){if(kind==='materials')return cents(Number(row.price)*Number(row.quantity)*(1-Number(row.discount||0)/100));if(kind==='other')return cents(Number(row.price));return cents(durationHours(row.duration)*Number(row.rate)*(1+Number(row.surcharge50||0)*.5+Number(row.surcharge100||0)))}
export function ledgerTotals(ledger?:Ledger){const value=ledger||blankLedger();const totals=Object.fromEntries(ledgerKinds.map(k=>[k,(value[k]||[]).reduce((n,r)=>cents(n+ledgerLineTotal(k,r)),0)])) as Record<LedgerKind,number>;return {...totals,total:ledgerKinds.reduce((n,k)=>cents(n+totals[k]),0),hours:(value.labor||[]).reduce((n,r)=>n+durationHours(r.duration),0)}}
export function validateLedger(input:any,employees:any[]){if(!input||typeof input!=='object')throw new Error('Aufwandsdaten fehlen.');const out=blankLedger();const ids=new Set();for(const kind of ledgerKinds){if(!Array.isArray(input[kind])||input[kind].length>1000)throw new Error('Ungültige Anzahl von Aufwandspositionen.');for(const row of input[kind]){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new Error('Position ist ungültig oder doppelt.');ids.add(row.id);if(typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)!==row.date)throw new Error('Bitte ein gültiges Datum angeben.');if(typeof row.name!=='string'||!row.name.trim()||row.name.length>500)throw new Error('Bezeichnung fehlt.');const r:any={id:row.id,date:row.date,name:row.name.trim()};const number=(key:string,defaultValue?:number)=>{const value=row[key]??defaultValue;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e8)throw new Error('Ungültiger Wert für '+key+'.');return value};if(kind==='materials'){r.article=String(row.article||'').slice(0,100);r.unit=String(row.unit||'Stk.').slice(0,25);r.price=number('price');r.quantity=number('quantity');r.discount=number('discount',0);if(r.quantity<=0||r.discount>100)throw new Error('Menge muss positiv sein; Rabatt zwischen 0 und 100 %.');}else if(kind==='other')r.price=number('price');else{r.duration=normalizeDuration(String(row.duration??''));if(!Number.isFinite(durationHours(r.duration))||durationHours(r.duration)<=0)throw new Error('Zeit bitte als Stunden (z. B. 8 oder 8,5) oder Stunden:Minuten (08:30) eingeben.');r.rate=number('rate');r.surcharge50=number('surcharge50',0);r.surcharge100=number('surcharge100',0);if(![0,1].includes(r.surcharge50)||![0,1].includes(r.surcharge100)||r.surcharge50+r.surcharge100>1)throw new Error('Bitte einen Zuschlag auswählen.');if(kind==='labor'){r.employee=String(row.employee||'');if(!employees.some(e=>e.id===r.employee))throw new Error('Bitte Mitarbeiter auswählen.');}}out[kind].push(r)}}return out}
export const steelArticles=[{id:'ST-012',name:'Blech 12 mm',group:'Stahl',subgroup:'Blech',unit:'m²',price:161.49,supplier:''},{id:'ST-035',name:'Blech 35 mm',group:'Stahl',subgroup:'Blech',unit:'m²',price:537,supplier:''},{id:'ST-020',name:'Blech 20 mm',group:'Stahl',subgroup:'Blech',unit:'m²',price:279.66,supplier:''},{id:'ST-F050',name:'Flachstahl 50 × 10 mm',group:'Stahl',subgroup:'Flachstahl',unit:'m',price:12.8,supplier:''},{id:'ST-R060',name:'Rundstahl Ø 60 mm',group:'Stahl',subgroup:'Rundstahl',unit:'m',price:36.5,supplier:''},{id:'ST-Q100',name:'Formrohr 100 × 100 mm',group:'Stahl',subgroup:'Formrohre quad',unit:'m',price:28.4,supplier:''},{id:'AL-003',name:'Aluminiumblech 3 mm',group:'Aluminium',subgroup:'Blech',unit:'m²',price:87.5,supplier:''}];
export const machineChoices=['Abkantpresse','Bohrwerk','Brennschneiden','Drehen','Drehen CNC','Einrollen','Fräsen CNC','Plasma','Schlagschere','Stanzen','WIG-Schweißen'];

export function laborHourlyRate(customer:any,employee:any){return Number(customer?.hourlyRate??employee?.hourlyRate??70)}

export function createLedgerRow(kind:LedgerKind,employees:any[],context:{date:string,employee?:string,customer?:any},id:string){
 const employee=employees.find(e=>e.id===context.employee)||employees[0];const row:any={id,date:context.date,name:''};
 if(kind==='materials')Object.assign(row,{unit:'Stk.',article:'',quantity:1,price:0,discount:0});
 else if(kind==='other')row.price=0;
 else Object.assign(row,{duration:'01:00',rate:kind==='labor'?laborHourlyRate(context.customer,employee):30,surcharge50:0,surcharge100:0,...(kind==='labor'?{employee:employee?.id||'',name:employee?.name||''}:{name:'Plasma'})});
 return row;
}
