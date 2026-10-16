const customerNames=new Intl.Collator('de-AT',{sensitivity:'base',numeric:true});
export function compareCustomerNames(a:any,b:any){return customerNames.compare(String(a.name||'').trim(),String(b.name||'').trim())}
export const customerOrderStatuses=['In Arbeit','Arbeit fertig','Rechnung gedruckt','Rechnung bezahlt'] as const;
export type CustomerOrderStatus=typeof customerOrderStatuses[number];
export function accountingStatus(order:any):CustomerOrderStatus {
 if(customerOrderStatuses.includes(order.accountingStatus))return order.accountingStatus;
 if(customerOrderStatuses.includes(order.status))return order.status;
 if(order.status==='Abgerechnet')return 'Rechnung gedruckt';
 if(order.status==='Fertig')return 'Arbeit fertig';
 return 'In Arbeit';
}
export function customerOrderSelection(customers:any[],orders:any[],options:{statuses:string[],mode:string,query?:string,type?:string,workflow?:string}){
 const relevant=orders.filter(o=>(!options.type||options.type==='Alle Auftragsarten'||o.type===options.type)&&(!options.workflow||options.workflow==='Alle Status'||o.status===options.workflow));
 const matching=relevant.filter(o=>o.status!=='Storniert'&&options.statuses.includes(accountingStatus(o)));
 const counts=new Map(customers.map(c=>[c.id,matching.filter(o=>o.customer===c.id).length]));
 const q=(options.query||'').trim().toLocaleLowerCase('de-AT');
 const visibleCustomers=customers.filter(c=>{
  const count=counts.get(c.id)||0;
  if(options.mode==='with'&&!count)return false;
  if(options.mode==='without'&&count)return false;
  return !q||[c.name,c.contact,c.address,c.phone,c.email,c.number,c.id,...relevant.filter(o=>o.customer===c.id).flatMap(o=>[o.number,o.title,o.reference])].join(' ').toLocaleLowerCase('de-AT').includes(q);
 }).sort(compareCustomerNames);
 const ids=new Set(visibleCustomers.map(c=>c.id));
 const shownOrders=(options.mode==='without'?relevant:matching).filter(o=>ids.has(o.customer));
 return {customers:visibleCustomers,orders:shownOrders,counts,matching};
}
