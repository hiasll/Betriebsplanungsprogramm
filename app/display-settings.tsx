'use client';
import {useRef,useState} from 'react';
import {GripVertical} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Slider} from '@/components/ui/slider';
import {DEFAULT_ROW_HEIGHT,MIN_ROW_HEIGHT,MAX_ROW_HEIGHT,displayEmployees,displayRowHeight} from '@/lib/display';
import {toast} from 'sonner';

export default function DisplaySettings({employees,settings,onClose,onSaved}:any){
  const [height,setHeight]=useState(String(displayRowHeight(settings?.rowHeight)));
  const [order,setOrder]=useState<string[]>(()=>displayEmployees(employees,settings?.employeeOrder).map((e:any)=>e.id));
  const [version,setVersion]=useState(settings?.version);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[announcement,setAnnouncement]=useState('');
  const [dragged,setDragged]=useState<string|null>(null);
  const pending=useRef({body:'',key:''});
  const rows=displayEmployees<any>(employees,order);
  const numeric=Number(height),valid=height!==''&&Number.isInteger(numeric)&&numeric>=MIN_ROW_HEIGHT&&numeric<=MAX_ROW_HEIGHT;
  function move(id:string,to:number){
    const ids=rows.map((e:any)=>e.id),from=ids.indexOf(id);
    if(from<0||to<0||to>=ids.length||from===to)return;
    ids.splice(from,1);ids.splice(to,0,id);setOrder(ids);
    setAnnouncement(`${rows.find((e:any)=>e.id===id)?.name} steht jetzt an Position ${to+1}.`);
  }
  async function save(){
    if(!valid)return;setBusy(true);setError('');
    const item={id:'display',version,rowHeight:numeric,employeeOrder:rows.map((e:any)=>e.id)};
    const command={action:'displaySettings',item},body=JSON.stringify(command);
    if(pending.current.body!==body)pending.current={body,key:crypto.randomUUID()};
    try{
      const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,requestId:pending.current.key})});
      const result=await r.json();if(!r.ok)throw new Error(result.error||'Speichern fehlgeschlagen.');
      onSaved({...item,version:(version||0)+1});toast.success('Zeittafel-Einstellungen gespeichert');onClose();
    }catch(e:any){setError(e.message||'Verbindung unterbrochen. Bitte erneut speichern.');}finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}><DialogContent className="app-dialog display-settings-dialog" showCloseButton={!busy}>
    <DialogTitle>Zeittafel einstellen</DialogTitle>
    <DialogDescription>Zeilenhöhe und Mitarbeiterreihenfolge gelten für alle Zeittafeln des Betriebs.</DialogDescription>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={busy} className="display-settings-fields">
        <div className="display-height-heading"><label htmlFor="display-row-height">Zeilenhöhe</label><div><input id="display-row-height" type="number" min={MIN_ROW_HEIGHT} max={MAX_ROW_HEIGHT} step={1} value={height} onChange={e=>setHeight(e.target.value)} required/><span>px</span></div></div>
        <div className="display-height-presets">{[100,120,160,220,320].map(px=><button key={px} type="button" className={'btn '+(numeric===px?'primary':'')} aria-pressed={numeric===px} onClick={()=>setHeight(String(px))}>{px} px</button>)}</div>
        <Slider aria-label="Zeilenhöhe" min={MIN_ROW_HEIGHT} max={MAX_ROW_HEIGHT} step={10} value={[valid?numeric:DEFAULT_ROW_HEIGHT]} onValueChange={v=>setHeight(String(v[0]))} disabled={busy}/>
        <p className="form-note">Mindesthöhe von {MIN_ROW_HEIGHT} bis {MAX_ROW_HEIGHT} px. Bei mehreren Einsätzen wächst die Zeile automatisch mit.</p>
        <div className="display-order-heading"><h3>Mitarbeiter anordnen</h3><button className="btn" type="button" onClick={()=>{setHeight(String(DEFAULT_ROW_HEIGHT));setOrder(employees.map((e:any)=>e.id));setAnnouncement('Standardhöhe und ursprüngliche Reihenfolge wiederhergestellt.')}}>Zurücksetzen</button></div>
        <p className="form-note">Am Griff ziehen oder mit „Nach oben“ und „Nach unten“ verschieben.</p>
        <ol className="display-order-list">{rows.map((employee:any,index:number)=><li key={employee.id} className={dragged===employee.id?'is-dragging':''} onDragOver={e=>{if(dragged){e.preventDefault();e.dataTransfer.dropEffect='move';}}} onDrop={e=>{e.preventDefault();if(dragged)move(dragged,index);setDragged(null);}}>
          <span className="display-drag-handle" draggable={!busy} title={`${employee.name} ziehen`} onDragStart={e=>{setDragged(employee.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-metallwerk-display-row',employee.id);}} onDragEnd={()=>setDragged(null)}><GripVertical size={20}/></span>
          <span className="display-position">{index+1}</span><span className="display-employee-name"><strong>{employee.name}</strong><small>{employee.group}</small></span>
          <div className="display-order-actions"><button type="button" className="btn" disabled={busy||index===0} aria-label={`${employee.name} nach oben`} onClick={()=>move(employee.id,index-1)}>Nach oben</button><button type="button" className="btn" disabled={busy||index===rows.length-1} aria-label={`${employee.name} nach unten`} onClick={()=>move(employee.id,index+1)}>Nach unten</button></div>
        </li>)}</ol>
        {!rows.length&&<p className="form-note">Noch keine Mitarbeiter vorhanden.</p>}
      </fieldset>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {error&&<div className="display-save-error" role="alert"><p>{error}</p><button type="button" className="btn" disabled={busy} onClick={()=>{setHeight(String(displayRowHeight(settings?.rowHeight)));setOrder(displayEmployees<any>(employees,settings?.employeeOrder).map(e=>e.id));setVersion(settings?.version);setError('');pending.current={body:'',key:''};}}>Gespeicherten Stand laden</button></div>}
      <div className="dialog-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button className="btn primary" type="submit" disabled={busy||!valid}>{busy?'Wird gespeichert …':'Einstellungen speichern'}</button></div>
    </form>
  </DialogContent></Dialog>;
}
