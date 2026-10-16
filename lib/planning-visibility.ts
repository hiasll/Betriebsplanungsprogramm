import {localParts,addDays,toInstant} from './time';
import {planningRanges,rangeHours} from './planning-time';
const boundsCache=new Map<string,[number,number]>();
const daysCache=new WeakMap<object,{key:string,days:Map<string,any>}>();
export function planningDay(assignment:any,day:string,zone='Europe/Vienna') {
 if(!assignment||assignment.cancelled)return null;
 try{
  const key=[zone,assignment.date,assignment.endDate,assignment.start,assignment.end,assignment.startAt,assignment.endAt,assignment.occurrence,assignment.endOccurrence,assignment.morningBreak,assignment.afternoonBreak,(assignment.excludedDates||[]).join(',')].join('|');let cached=daysCache.get(assignment);if(!cached||cached.key!==key){cached={key,days:new Map()};daysCache.set(assignment,cached)}if(cached.days.has(day))return cached.days.get(day);if(cached.days.size>=64)cached.days.clear();
  const boundsKey=zone+':'+day;if(!boundsCache.has(boundsKey)){if(boundsCache.size>=512)boundsCache.clear();boundsCache.set(boundsKey,[toInstant(day,'00:00',zone),toInstant(addDays(day,1),'00:00',zone)])}
  const [start,end]=boundsCache.get(boundsKey)!;
  const labels:string[]=[];let hours=0,grossHours=0,pauseHours=0,lunchHours=0,morningHours=0,afternoonHours=0,from=Infinity,to=-Infinity;
  for(const range of planningRanges(assignment,zone)){const a=Math.max(range[0],start),b=Math.min(range[1],end);if(b<=a)continue;const h=rangeHours(range,start,end,assignment,zone);labels.push(localParts(a,zone).time+'–'+(b===end?'24:00':localParts(b,zone).time));hours+=h.hours;grossHours+=h.grossHours;pauseHours+=h.pauseHours;lunchHours+=h.lunchHours;morningHours+=h.morningHours;afternoonHours+=h.afternoonHours;from=Math.min(from,a);to=Math.max(to,b)}
  if(to<=from){cached.days.set(day,null);return null;}
  const result={hours,grossHours,pauseHours,lunchHours,morningHours,afternoonHours,timeLabel:labels.join(' / '),start:localParts(from,zone).time,end:to===end?'24:00':localParts(to,zone).time};cached.days.set(day,result);return result;
 }catch{return null}
}

export function planningSelection(data:any,dates:string[],options:any={}){const zone=data?.settings?.find((s:any)=>s.id==='company')?.timezone||'Europe/Vienna',employees=data?.employees||[],orders=data?.orders||[],customers=data?.customers||[];const visibleEmployees=employees.filter((e:any)=>!options.group||options.group==='Alle Mitarbeiter'||e.group===options.group||e.id===options.group);const employeeIds=new Set(visibleEmployees.map((e:any)=>e.id)),q=(options.query||'').trim().toLowerCase();const matchingOrders=orders.filter((o:any)=>(!options.type||options.type==='Alle Auftragsarten'||o.type===options.type)&&(!options.status||options.status==='Alle Status'||o.status===options.status)&&[o.number,o.title,o.location,customers.find((c:any)=>c.id===o.customer)?.name,customers.find((c:any)=>c.id===o.customer)?.contact].join(' ').toLowerCase().includes(q));const orderIds=new Set(matchingOrders.map((o:any)=>o.id));const all=(data?.assignments||[]).filter((a:any)=>dates.some(d=>planningDay(a,d,zone)));const assignments=all.filter((a:any)=>employeeIds.has(a.employee)&&orderIds.has(a.order));return {employees:visibleEmployees,orders:matchingOrders,assignments,total:all.length,hidden:all.length-assignments.length}}
