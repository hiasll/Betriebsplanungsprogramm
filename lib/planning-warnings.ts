import {absenceOverlaps} from './planning-days';
import {interval,localParts,addDays,toInstant} from './time';
import {planningRanges,rangeHours,rangesOverlap,PlanRange} from './planning-time';
export type PlanningWarning={kind:'collision'|'absence'|'resource'|'hours',label:string};
export function planningWarnings(data:any):Record<string,PlanningWarning[]>{
 const result:Record<string,PlanningWarning[]>={};if(!data)return result;
 const zone=data.settings?.find((s:any)=>s.id==='company')?.timezone||'Europe/Vienna',rows=(data.assignments||[]).filter((a:any)=>!a.cancelled),ranges=new Map<string,PlanRange[]>();
 for(const a of rows){try{ranges.set(a.id,planningRanges(a,zone))}catch{}}
 const add=(a:any,kind:PlanningWarning['kind'],label:string)=>{const list=result[a.id]??=[];if(!list.some(x=>x.kind===kind&&x.label===label))list.push({kind,label})};
 const weeklyTotals=new Map<string,number>(),weekBounds=new Map<string,PlanRange>();
 for(const a of rows){const slots=ranges.get(a.id);if(!slots?.length)continue;
  for(const b of rows){const other=ranges.get(b.id);if(a.id!==b.id&&a.employee===b.employee&&other&&rangesOverlap(slots,other)){const order=data.orders?.find((o:any)=>o.id===b.order);add(a,'collision','Doppelbelegung'+(order?' · #'+order.number:''))}}
  for(const absence of data.absences||[]){if(!absence.cancelled&&absence.employee===a.employee&&slots.some(([s,e])=>absenceOverlaps(absence,localParts(s,zone).date,localParts(e-1,zone).date)))add(a,'absence','Abwesenheit: '+absence.type)}
  const employee=data.employees?.find((e:any)=>e.id===a.employee);if(employee){const first=localParts(slots[0][0],zone).date,last=localParts(slots[slots.length-1][1]-1,zone).date,weekday=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
   for(let week=addDays(first,-weekday);week<=last;week=addDays(week,7)){
    if(!weekBounds.has(week))weekBounds.set(week,[toInstant(week,'00:00',zone),toInstant(addDays(week,7),'00:00',zone)]);
    const [start,end]=weekBounds.get(week)!,key=a.employee+':'+week;let sum=weeklyTotals.get(key);
    if(sum==null){sum=0;for(const b of rows){if(b.employee===a.employee)for(const r of ranges.get(b.id)||[])sum+=rangeHours(r,start,end,b,zone).hours}weeklyTotals.set(key,sum)}
    if(sum>Number(employee.hours))add(a,'hours','Sollstunden überschritten · '+sum.toLocaleString('de-AT',{maximumFractionDigits:1})+' / '+employee.hours+' h · Woche ab '+week)
   }
  }
 }
 const missions=data.missions||[];for(const mission of missions){if(mission.cancelled)continue;const crew=rows.filter((a:any)=>a.mission===mission.id&&ranges.has(a.id));if(!crew.length)continue;const bounds=crew.flatMap((a:any)=>ranges.get(a.id)!);
  for(const rid of mission.resources||[]){const name=data.resources?.find((r:any)=>r.id===rid)?.name||rid;
   for(const block of data.resourceBlocks||[]){if(block.resource!==rid)continue;try{if(rangesOverlap(bounds,[interval(block,zone)]))crew.forEach((a:any)=>add(a,'resource','Ressource gesperrt: '+name))}catch{}}
   for(const other of missions){if(other.id===mission.id||other.cancelled||!(other.resources||[]).includes(rid))continue;const others=rows.filter((a:any)=>a.mission===other.id&&ranges.has(a.id));const otherBounds=others.flatMap((a:any)=>ranges.get(a.id)!);if(rangesOverlap(bounds,otherBounds))crew.forEach((a:any)=>add(a,'resource','Ressourcenkollision: '+name))}
  }
 }
 return result;
}
