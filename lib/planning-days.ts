import {addDays} from './time';
export function absenceOnDay(a:any,day:string){return !a.cancelled&&a.date<=day&&a.end>=day&&!(a.excludedDates||[]).includes(day)}
export function absenceOverlaps(a:any,from:string,to:string,excluded:string[]=[]){
 if(a.cancelled)return false;const end=a.end<to?a.end:to;
 for(let day=a.date>from?a.date:from;day<=end;day=addDays(day,1))if(absenceOnDay(a,day)&&!excluded.includes(day))return true;
 return false;
}
