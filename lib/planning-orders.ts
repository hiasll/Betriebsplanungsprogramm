import {activeCustomer} from './customer-status';
import {accountingStatus} from './customer-order-filters';
const blocked=new Set(['fertig','storniert','abgerechnet','anfrage','angebot','arbeit fertig','rechnung gedruckt','rechnung bezahlt']);
export function isPlannableOrder(order:any){
 if(!order)return false;
 const norm=(s:any)=>String(s||'').trim().toLocaleLowerCase('de-AT');
 return !blocked.has(norm(order.status))&&!blocked.has(norm(order.type))&&accountingStatus(order)==='In Arbeit';
}
export function planningOrderSelection(data:any,customer=''){
 const active=(data.orders||[]).filter((o:any)=>isPlannableOrder(o)&&activeCustomer((data.customers||[]).find((c:any)=>c.id===o.customer)));
 const customers=(data.customers||[]).filter((c:any)=>active.some((o:any)=>o.customer===c.id)).sort((a:any,b:any)=>a.name.localeCompare(b.name,'de-AT'));
 return {customers,orders:customer?active.filter((o:any)=>o.customer===customer):[],active};
}
export function planningOrderForm(data:any,item:any){
 const selected=(data.orders||[]).find((o:any)=>o.id===item.order),choices=planningOrderSelection(data);
 const customer=item.customer||selected?.customer||'';
 const validCustomer=choices.customers.some((c:any)=>c.id===customer)?customer:'';
 return {...item,customer:validCustomer,order:selected&&isPlannableOrder(selected)&&selected.customer===validCustomer?selected.id:''};
}
export function changePlanningCustomer(form:any,customer:string){return {...form,customer,order:''}}
