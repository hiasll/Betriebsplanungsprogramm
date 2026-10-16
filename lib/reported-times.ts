import {durationHours} from './order-ledger';
import {interval} from './time';
export function reportedTimeEntries(data:any){
 if(!data)return [];
 const zone=data.settings?.find((s:any)=>s.id==='company')?.timezone||'Europe/Vienna';
 const native=(data.times||[]).map((t:any)=>{const [a,b]=interval(t,zone);return {...t,id:'time:'+t.id,hours:(b-a)/3600000,source:'Zeiterfassung',sourceId:t.id}});
 const durationEntries=(data.orders||[]).flatMap((o:any)=>(o.ledger?.labor||[]).map((r:any)=>({id:'order:'+o.id+':'+r.id,sourceId:r.id,source:'Auftrag',order:o.id,employee:r.employee,date:r.date,hours:durationHours(r.duration),duration:r.duration,type:['Reparatur','Wartung'].includes(o.type)?'Service':['Eigenbetrieblich','Sonstiges'].includes(o.type)?'interne Arbeit':o.type||'Produktion'})));
 return [...native,...durationEntries].filter((t:any)=>Number.isFinite(t.hours)&&t.hours>0);
}
export function reportedMachineEntries(data:any){if(!data)return [];return (data.orders||[]).flatMap((o:any)=>(o.ledger?.machines||[]).map((r:any)=>({id:'machine:'+o.id+':'+r.id,order:o.id,date:r.date,name:r.name,hours:durationHours(r.duration),duration:r.duration}))).filter((r:any)=>Number.isFinite(r.hours)&&r.hours>0)}
export function employeeTimeSummary(entries:any[],employee:string,dates:string[]){const rows=entries.filter(t=>t.employee===employee&&dates.includes(t.date)&&t.type!=='Pause');const sum=(types?:string[])=>rows.filter(t=>!types||types.includes(t.type)).reduce((n,t)=>n+t.hours,0);return {rows,total:sum(),production:sum(['Produktion']),construction:sum(['Baustelle','Montage']),service:sum(['Service']),internal:sum(['Fahrtzeit','interne Arbeit','Arbeitsvorbereitung','Lager']),fromOrders:rows.filter(t=>t.source==='Auftrag').reduce((n,t)=>n+t.hours,0)}}
