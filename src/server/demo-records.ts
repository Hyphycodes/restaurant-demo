import { buildRecords } from '@/server/migration/records';
import { buildStaffDemo } from '@/server/staff/demo';
import type { Row } from '@/lib/db/types';

/** Fictional operations records, seeded only into a visitor's temporary workspace. */
export function buildDemoRecords():Record<string,Row[]> {
 const tables={...buildRecords().tables,...buildStaffDemo()};const now=new Date().toISOString();
 tables.inquiries=[
  {id:'demo-inquiry-1',type:'private-event',name:'Jamie Morgan',email:'jamie@example.invalid',phone:'(312) 555-0109',status:'new',created_at:now,payload:{eventType:'Rehearsal dinner',guests:24,date:'2026-11-14',message:'A family-style dinner for 24. Interested in a private room and a welcome aperitivo.'}},
  {id:'demo-inquiry-2',type:'catering',name:'Avery Brooks',email:'avery@example.invalid',phone:'(312) 555-0110',status:'new',created_at:now,payload:{guests:20,message:'The Sunday Table package for a studio team lunch. Vegetarian alternatives for four guests.'}},
 ];
 tables.job_applications=[{id:'demo-applicant',reference:'JOB-DEMO-001',name:'Isabella Reed',email:'isabella@example.invalid',phone:'(312) 555-0111',position:'Server',opening_id:tables.job_openings?.[0]?.id,status:'new',availability:'Wednesday through Sunday evenings',experience:'Three years of thoughtful dinner service in neighborhood restaurants.',notes:'Enjoys wine education and family-style service.',created_at:now,updated_at:now,archived_at:null}];
 tables.talent_submissions=[{id:'demo-talent',reference:'TAL-DEMO-001',name:'Enzo Vale',email:'enzo@example.invalid',phone:null,discipline:'dj',pitch:'Warm soul, disco and Italian records on vinyl.',links:[],idea:'An all-vinyl aperitivo residency.',status:'new',created_at:now,updated_at:now,archived_at:null}];
 tables.ticket_tiers=(tables.event_occurrences??[]).filter(e=>!e.series_slug).map((e,i)=>({id:`demo-tier-${i}`,event_id:e.id,name:'Supper Club Admission',description:'Sample admission, including the evening’s aperitivo.',price_cents:i===1?5800:i===2?4500:2800,capacity:60,seats_per_ticket:1,min_per_order:1,max_per_order:6,sort_order:0,active:true,archived_at:null}));
 for(const event of tables.event_occurrences??[]){if(!event.series_slug){event.flyer_asset_id=event.id==='demo-vinyl-opening'?'flyerVinyl':'flyerSupper';event.capacity=60;event.ticketing_enabled=true;event.age_policy='21+';event.source='manual';event.source_url=null;event.source_event_id=null;}}
 return tables;
}
