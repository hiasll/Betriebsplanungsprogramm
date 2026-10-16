import {activeCustomer} from './customer-status';
import {readModel,executeMaintenance} from './repository';
import {getZone,RuleError} from './operations';
import {addDays,localParts} from './time';

// Called only by the Worker scheduled handler, never by an unauthenticated HTTP route.
export async function runMaintenanceJob(db:any,now=Date.now(),limit=50){
  let generated=0,conflicts=0;
  for(let attempt=0;attempt<limit;attempt++){
    const {model}=await readModel(db);
    const today=localParts(now,getZone(model)).date;
    const due=model.maintenance.filter(p=>p.active!==false&&activeCustomer(model.customers.find(c=>c.id===p.customer))&&p.nextDue<=addDays(today,Number(p.leadDays??14)))
      .sort((a,b)=>a.nextDue.localeCompare(b.nextDue)||a.id.localeCompare(b.id));
    if(!due.length)return {generated,conflicts,remaining:false};
    const p=due[0];
    try{await executeMaintenance(db,p.id,p.nextDue,now);generated++;}
    catch(e){if(e instanceof RuleError&&e.status===409){conflicts++;continue;}throw e;}
  }
  throw new Error(`Wartungslauf benötigt Fortsetzung: ${generated} Termine verarbeitet, ${conflicts} Konflikte.`);
}
