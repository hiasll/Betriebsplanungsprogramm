'use client';
import React from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {planningOrderSelection} from '@/lib/planning-orders';
export default function PlanningOrderPicker({data,value,onCustomer,onOrder}:any){
 const {customers,orders}=planningOrderSelection(data,value.customer);
 const selected=orders.some((o:any)=>o.id===value.order)?value.order:'';
 return <div className="planning-order-picker full">
  <label className="field">Kunde<Select value={value.customer||''} onValueChange={onCustomer} disabled={!customers.length}><SelectTrigger aria-label="Kunde für Einsatz auswählen"><SelectValue placeholder="Zuerst Kunde auswählen"/></SelectTrigger><SelectContent>{customers.map((c:any)=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></label>
  <label className="field">Auftrag<Select value={selected} onValueChange={onOrder} disabled={!value.customer||!orders.length}><SelectTrigger aria-label="Offenen Auftrag für Einsatz auswählen"><SelectValue placeholder={value.customer?'Offenen Auftrag auswählen':'Zuerst Kunde auswählen'}/></SelectTrigger><SelectContent>{orders.map((o:any)=><SelectItem key={o.id} value={o.id}>#{o.number} · {o.title}</SelectItem>)}</SelectContent></Select></label>
  <p className="form-note full">{!customers.length?'Keine Kunden mit einplanbaren Aufträgen vorhanden.':value.customer?orders.length+' offene Aufträge für diesen Kunden.':'Bitte zuerst einen Kunden wählen.'} Fertige, stornierte und abgerechnete Aufträge sowie Anfragen und Angebote sind ausgeblendet.</p>
 </div>;
}
