export const customerStates=['Aktiv','Gesperrt','Archiviert'] as const;
export function customerState(customer:any){return customer?.customerStatus||'Aktiv'}
export function activeCustomer(customer:any){return customerState(customer)==='Aktiv'}
export function customerMatches(customer:any,filter:string){return filter==='Alle'||customerState(customer)===filter}
