export const DEFAULT_ROW_HEIGHT=220;
export const MIN_ROW_HEIGHT=100;
export const MAX_ROW_HEIGHT=480;
export function displayEmployees<T extends {id:string}>(employees:T[],order:unknown):T[]{
  const ids=Array.isArray(order)?order:[];
  const rank=new Map(ids.map((id,i)=>[id,i]));
  return [...employees].sort((a,b)=>(rank.get(a.id)??ids.length)-(rank.get(b.id)??ids.length));
}
export function displayRowHeight(value:unknown){
  return typeof value==='number'&&Number.isInteger(value)&&value>=MIN_ROW_HEIGHT&&value<=MAX_ROW_HEIGHT?value:DEFAULT_ROW_HEIGHT;
}
