import {addDays,interval,toInstant,localParts} from './time';
export type PlanRange=[number,number]&{source?:[number,number]};
const cache=new WeakMap<object,{key:string,ranges:PlanRange[]}>();
/** Repeats the selected local time window; overnight ranges end on endDate. */
export function planningRanges(a:any,zone='Europe/Vienna'):PlanRange[]{
 if(!a||a.cancelled)return [];
 const key=[zone,a.date,a.endDate,a.start,a.end,a.occurrence,a.endOccurrence,a.startAt,a.endAt,(a.excludedDates||[]).join(',')].join('|');
 const cached=cache.get(a);if(cached?.key===key)return cached.ranges;
 interval(a,zone);const last=a.endDate||a.date,night=a.end<=a.start;
 if(night&&last===a.date)throw new Error('Bei Nachteinsätzen das Enddatum ergänzen.');
 const ranges:PlanRange[]=[];
 for(let day=a.date;night?day<last:day<=last;day=addDays(day,1)){
  if(ranges.length>=366)throw new Error('Planungszeitraum ist auf 366 Tage begrenzt.');
  const start=toInstant(day,a.start,zone,a.occurrence),end=toInstant(night?addDays(day,1):day,a.end,zone,a.endOccurrence||a.occurrence);
  if(end<=start)throw new Error('Das Ende muss nach dem Beginn liegen.');ranges.push([start,end]);
 }
 let visible=ranges;
 for(const day of a.excludedDates||[]){const from=toInstant(day,'00:00',zone),to=toInstant(addDays(day,1),'00:00',zone);visible=visible.flatMap(r=>{if(r[1]<=from||r[0]>=to)return [r];const parts:PlanRange[]=[];if(r[0]<from)parts.push(Object.assign([r[0],from] as PlanRange,{source:r.source||r}));if(r[1]>to)parts.push(Object.assign([to,r[1]] as PlanRange,{source:r.source||r}));return parts})}
 cache.set(a,{key,ranges:visible});return visible;
}
export function emptyPlanHours(){return {grossHours:0,pauseHours:0,lunchHours:0,morningHours:0,afternoonHours:0,hours:0}}
export function rangeHours(range:PlanRange,from=range[0],to=range[1],options:any={},zone='Europe/Vienna'){
 const [start,end]=range,[workStart,workEnd]=range.source||range;const a=Math.max(start,from),b=Math.min(end,to);if(b<=a)return emptyPlanHours();
 const cut=(s:number,e:number)=>Math.max(0,Math.min(b,e)-Math.max(a,s))/3600000;
 const breakStart=Math.min(workStart+6*3600000,workEnd-3600000),grossHours=(b-a)/3600000;
 const lunchHours=(workEnd-workStart)>6*3600000?cut(breakStart,breakStart+3600000):0;
 let morningHours=0,afternoonHours=0;
 for(let day=localParts(a,zone).date;day<=localParts(b-1,zone).date;day=addDays(day,1)){
  if(options.morningBreak===true)morningHours+=cut(toInstant(day,'09:00',zone),toInstant(day,'09:15',zone));
  if(options.afternoonBreak===true)afternoonHours+=cut(toInstant(day,'15:00',zone),toInstant(day,'15:15',zone));
 }
 const pauseHours=Math.min(grossHours,lunchHours+morningHours+afternoonHours);
 return {grossHours,pauseHours,lunchHours,morningHours,afternoonHours,hours:grossHours-pauseHours};
}
export function planningTotals(a:any,zone='Europe/Vienna'){
 return planningRanges(a,zone).reduce((sum,r)=>{const h=rangeHours(r,r[0],r[1],a,zone);for(const k of Object.keys(sum) as (keyof typeof sum)[])sum[k]+=h[k];return sum},emptyPlanHours());
}
export function rangesOverlap(a:PlanRange[],b:PlanRange[]){return a.some(([s,e])=>b.some(([x,y])=>s<y&&x<e))}
