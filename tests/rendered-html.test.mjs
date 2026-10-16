import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
test('Auftragsfenster rendert Statusauswahl und Kundenansicht mit passenden Aufträgen',async()=>{
 const {default:CustomerOrders}=await vite.ssrLoadModule('/app/customer-orders.tsx');
 const data={customers:[{id:'a',name:'Binderholz'},{id:'b',name:'Bezahlt GmbH'}],orders:[{id:'o1',customer:'a',number:'34955',title:'Wurzelreduzieren',status:'Produktion',accountingStatus:'In Arbeit',type:'Produktion'},{id:'o2',customer:'b',number:'2',title:'Bezahlter Auftrag',status:'Abgerechnet',accountingStatus:'Rechnung bezahlt',type:'Service'}]};
 const html=renderToStaticMarkup(React.createElement(CustomerOrders,{data,types:['Produktion','Service'],workflows:['Produktion','Abgerechnet'],onOrder(){},onCustomer(){},onCreate(){}}));
 for(const status of ['In Arbeit','Arbeit fertig','Rechnung gedruckt','Rechnung bezahlt'])assert(html.includes(status));
 assert(html.includes('Ohne passende Aufträge'));assert(html.includes('Alle Kunden'));assert(html.includes('Wurzelreduzieren'));assert(!html.includes('Bezahlter Auftrag'));assert(!html.includes('Bezahlt GmbH'));
});

test('Auftragsbearbeitung rendert vier editierbare Tabellen, Artikelauswahl und Cent-Summen',async()=>{
 const {default:OrderLedger}=await vite.ssrLoadModule('/app/order-ledger.tsx');
 const order={id:'o1',number:'34955',title:'Wurzelreduzieren',customer:'c1',version:1,ledger:{materials:[{id:'r1',date:'2030-01-07',name:'Blech 12 mm',unit:'m²',price:161.49,quantity:1.5,discount:0}],labor:[],machines:[],other:[]}};
 const data={employees:[{id:'e1',name:'Matthias Kreidl'}],resources:[],inventory:[],customers:[{id:'c1',name:'Binderholz'}]};
 const html=renderToStaticMarkup(React.createElement(OrderLedger,{order,data,user:{role:'Admin'},reload(){}}));
 for(const word of ['Materialaufwand','Arbeitszeiten','Maschinenzeiten','Sonstiges','Artikelauswahl','Positionen speichern','Blech 12 mm','242,24'])assert(html.includes(word));
 assert(html.includes('type="date"'));assert(html.includes('type="number"'));
});

test('Zeitauswertung und Zeittafelkarten zeigen Arbeitszeiten aus der Auftragsbearbeitung',async()=>{
 const {default:TimeEvaluation,RecordedTimeCards,RecordedMachines}=await vite.ssrLoadModule('/app/time-evaluation.tsx');
 const data={employees:[{id:'e1',name:'Matthias Kreidl',hours:40}],customers:[{id:'c1',name:'Binderholz'}],orders:[{id:'o1',number:'34955',title:'Wurzelreduzieren',customer:'c1',type:'Produktion',ledger:{labor:[{id:'r1',employee:'e1',date:'2030-01-07',duration:'06:30'}],machines:[{id:'m1',name:'Plasma',date:'2030-01-07',duration:'01:00'}]}}],times:[]};
 const html=renderToStaticMarkup(React.createElement(TimeEvaluation,{data,dates:['2030-01-07'],onOrder(){}}));for(const value of ['Matthias Kreidl','Wurzelreduzieren','6,5','Auftrag','Dauerbuchung','Plasma'])assert(html.includes(value));
 const cards=renderToStaticMarkup(React.createElement(RecordedTimeCards,{entries:[{id:'r1',order:'o1',hours:6.5,source:'Auftrag'}],orders:data.orders,customers:data.customers}));for(const value of ['6,5','Wurzelreduzieren','Binderholz','IST'])assert(cards.includes(value));assert(!cards.includes('07:00'));
});

test('Startseite rendert während des initialen Datenabrufs ohne Serverfehler',async()=>{
 const {default:App}=await vite.ssrLoadModule('/app/page.tsx');
 const html=renderToStaticMarkup(React.createElement(App));
 assert(html.includes('Betriebsplanung wird geladen'));assert(html.includes('KREIDL'));
});

test('Artikelstamm und CRM zeigen Eigenschaften, Import und Export sowie Preisgruppensteuerung',async()=>{
 const {default:MasterData}=await vite.ssrLoadModule('/app/master-data.tsx');
 const data={inventory:[{id:'a1',name:'Stahlblech',unit:'kg',weightKg:12.5,priceGroup:'Stahl',price:10,properties:[{label:'Werkstoff',value:'S235',unit:''}]}],customers:[{id:'c1',name:'Kunde',number:'100',properties:[{label:'Branche',value:'Metall',unit:''}]}]};
 for(const kind of ['inventory','customers']){const html=renderToStaticMarkup(React.createElement(MasterData,{kind,data,user:{role:'Admin'},reload(){},onEdit(){}}));for(const word of ['CSV exportieren','JSON exportieren','Importieren','Bearbeiten'])assert(html.includes(word));if(kind==='inventory'){assert(html.includes('Preisgruppe'));assert(html.includes('S235'));assert(html.includes('Gewicht kg'))}else assert(html.includes('Branche: Metall'));}
 const restricted=renderToStaticMarkup(React.createElement(MasterData,{kind:'inventory',data,user:{role:'Büro'},reload(){},onEdit(){}}));assert(!restricted.includes('Preise nach Preisgruppe'));
});
test('Planung zeigt zwei beschriftete Standardpausen mit unabhängigem Checkbox-Zustand',async()=>{
 const {PlanningBreakOptions}=await vite.ssrLoadModule('/app/enhancements.tsx');
 const render=value=>renderToStaticMarkup(React.createElement(PlanningBreakOptions,{value,onChange(){}}));const html=render({morningBreak:true,afternoonBreak:true});assert(html.includes('09:00–09:15'));assert(html.includes('15:00–15:15'));assert.equal((html.match(/role="checkbox"[^>]*aria-checked="true"/g)||[]).length,2);
 const mixed=render({morningBreak:false,afternoonBreak:true});assert.equal((mixed.match(/role="checkbox"[^>]*aria-checked="true"/g)||[]).length,1);assert.equal((mixed.match(/role="checkbox"[^>]*aria-checked="false"/g)||[]).length,1);
});
test('Planungsmaske zeigt Kunden zuerst und sperrt Auftrag bis zur Kundenauswahl',async()=>{
 const {default:PlanningOrderPicker}=await vite.ssrLoadModule('/app/planning-order-picker.tsx');const data={customers:[{id:'c1',name:'Kunde A'}],orders:[{id:'a',customer:'c1',number:'1',title:'Offen',status:'Produktion'}]};
 const render=value=>renderToStaticMarkup(React.createElement(PlanningOrderPicker,{data,value,onCustomer(){},onOrder(){}}));
 const html=render({customer:'',order:''});assert(html.indexOf('Kunde für Einsatz auswählen')<html.indexOf('Offenen Auftrag für Einsatz auswählen'));assert(/disabled=""[^>]*aria-label="Offenen Auftrag für Einsatz auswählen"/.test(html));assert(html.includes('Bitte zuerst einen Kunden wählen.'));
 const selected=render({customer:'c1',order:''});assert(selected.includes('1 offene Aufträge für diesen Kunden.'));assert(!/disabled=""[^>]*aria-label="Offenen Auftrag für Einsatz auswählen"/.test(selected));
});
test('Planungszugang bietet bestehende und neue Aufträge an und zeigt Buchungskontext',async()=>{
 const {PlanningBookingForm}=await vite.ssrLoadModule('/app/planning-booking-dialog.tsx');const context={employee:'e2',date:'2030-02-15'},data={customers:[{id:'z',name:'Zeller'},{id:'a',name:'Alpenbau'}],employees:[{id:'e1',name:'Erster Mitarbeiter'},{id:'e2',name:'Gewählter Mitarbeiter'}],orders:[],resources:[],inventory:[],settings:[]};
 const html=renderToStaticMarkup(React.createElement(PlanningBookingForm,{data,context,onClose(){},onSelect(){},onCreate(){}}));for(const text of ['Gewählter Mitarbeiter','Bestehender Auftrag','Neuen Auftrag anlegen','Auftrag öffnen'])assert(html.includes(text));assert(html.indexOf('Alpenbau')<html.indexOf('Zeller'));
 const {default:OrderLedger}=await vite.ssrLoadModule('/app/order-ledger.tsx');const ledger=renderToStaticMarkup(React.createElement(OrderLedger,{order:{id:'o1',version:1},data,user:{role:'Admin'},reload(){},bookingContext:context}));assert(ledger.includes('Buchung aus Planung'));assert(ledger.includes('Gewählter Mitarbeiter'));assert(ledger.includes('Datum und Mitarbeiter für neue Zeilen vorbelegt'));
});
test('CRM zeigt Statusfilter und blendet gesperrte und archivierte Kunden standardmäßig aus',async()=>{
 const {default:MasterData}=await vite.ssrLoadModule('/app/master-data.tsx');const data={customers:[{id:'a',name:'Aktiver Kunde'},{id:'b',name:'Gesperrter Kunde',customerStatus:'Gesperrt'},{id:'c',name:'Alter Kunde',customerStatus:'Archiviert'}]};const html=renderToStaticMarkup(React.createElement(MasterData,{kind:'customers',data,user:{role:'Admin'},onEdit(){},reload(){}}));for(const text of ['Kundenstatus','Aktiv','Gesperrt','Archiviert','Alle','Aktiver Kunde'])assert(html.includes(text));assert(!html.includes('Gesperrter Kunde'));assert(!html.includes('Alter Kunde'));
});
