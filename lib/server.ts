import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Datenbank nicht verfügbar');return env.DB}
export const tables:Record<string,{name:string,fields:Record<string,string>}>= {employees:{name:'employees',fields:{name:'name',employee_group:'group',weekly_hours:'hours'}},customers:{name:'customers',fields:{name:'name'}},orders:{name:'orders',fields:{number:'number',title:'title',customer_id:'customer',responsible_id:'responsible'}},assignments:{name:'order_assignments',fields:{order_id:'order',employee_id:'employee',date:'date',start:'start',end:'end'}},tasks:{name:'order_tasks',fields:{order_id:'order',employee_id:'employee'}},materials:{name:'materials',fields:{name:'name',order_id:'order'}},times:{name:'time_entries',fields:{order_id:'order',employee_id:'employee',date:'date'}},absences:{name:'absences',fields:{employee_id:'employee',date:'date',end:'end'}},documents:{name:'documents',fields:{order_id:'order'}},timers:{name:'timers',fields:{employee_id:'employee'}}};
export function insertRecord(kind:string,item:any,ignore=false){const t=tables[kind],cols=['id','data',...Object.keys(t.fields)];return db().prepare(`INSERT ${ignore?'OR IGNORE ':''}INTO ${t.name}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).bind(item.id,JSON.stringify(item),...Object.values(t.fields).map(k=>item[k]??null))}
export function updateRecord(kind:string,item:any){const t=tables[kind];return db().prepare(`UPDATE ${t.name} SET data=?,version=version+1,${Object.keys(t.fields).map(k=>k+'=?').join(',')} WHERE id=? AND version=?`).bind(JSON.stringify(item),...Object.values(t.fields).map(k=>item[k]??null),item.id,item.version)}

export function assignmentWrite(item:any,previous:boolean){
 const t=tables.assignments,fields=Object.keys(t.fields),values=Object.values(t.fields).map(k=>item[k]??null);
 const available="NOT EXISTS(SELECT 1 FROM order_assignments WHERE id<>? AND employee_id=? AND date=? AND start<? AND end>?) AND NOT EXISTS(SELECT 1 FROM absences WHERE employee_id=? AND date<=? AND end>=?)";
 const guard=[item.id,item.employee,item.date,item.end,item.start,item.employee,item.date,item.date];
 if(previous)return db().prepare(`UPDATE order_assignments SET data=?,version=version+1,${fields.map(k=>k+'=?').join(',')} WHERE id=? AND version=? AND ${available}`).bind(JSON.stringify(item),...values,item.id,item.version,...guard);
 return db().prepare(`INSERT INTO order_assignments(id,data,${fields.join(',')}) SELECT ?,?,${fields.map(()=>'?').join(',')} WHERE ${available}`).bind(item.id,JSON.stringify(item),...values,...guard);
}
