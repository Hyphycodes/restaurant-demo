import { buildRecords } from '@/server/migration/records';
import { buildStaffDemo } from '@/server/staff/demo';
import type { Row } from '@/lib/db/types';
import { buildDemoLinkHubs } from '@/server/demo-link-hubs';
import { venueIsoDate } from '@/lib/events';

/** Fictional operations records, seeded only into a visitor's temporary workspace. */
export function buildDemoRecords():Record<string,Row[]> {
 const tables={...buildRecords().tables,...buildStaffDemo()};const now=new Date().toISOString();
 tables.inquiries=demoInquiries();
 tables.job_applications=[{id:'demo-applicant',reference:'JOB-DEMO-001',name:'Isabella Reed',email:'isabella@example.invalid',phone:'(312) 555-0111',position:'Server',opening_id:tables.job_openings?.[0]?.id,status:'new',availability:'Wednesday through Sunday evenings',experience:'Three years of thoughtful dinner service in neighborhood restaurants.',notes:'Enjoys wine education and family-style service.',created_at:now,updated_at:now,archived_at:null}];
 tables.talent_submissions=[{id:'demo-talent',reference:'TAL-DEMO-001',name:'Enzo Vale',email:'enzo@example.invalid',phone:null,discipline:'dj',pitch:'Warm soul, disco and Italian records on vinyl.',links:[],idea:'An all-vinyl aperitivo residency.',status:'new',created_at:now,updated_at:now,archived_at:null}];
 tables.ticket_tiers=(tables.event_occurrences??[]).filter(e=>!e.series_slug).map((e,i)=>({id:`demo-tier-${i}`,event_id:e.id,name:'Supper Club Admission',description:'Sample admission, including the evening’s aperitivo.',price_cents:i===1?5800:i===2?4500:2800,capacity:60,seats_per_ticket:1,min_per_order:1,max_per_order:6,sort_order:0,active:true,archived_at:null}));
 for(const event of tables.event_occurrences??[]){if(!event.series_slug){event.flyer_asset_id=event.id==='demo-vinyl-opening'?'flyerVinyl':'flyerSupper';event.capacity=60;event.ticketing_enabled=true;event.age_policy='21+';event.source='manual';event.source_url=null;event.source_event_id=null;}}
 const hubs=buildDemoLinkHubs();
 tables.link_hubs=hubs.hubs;
 tables.link_hub_blocks=hubs.blocks;
 return tables;
}

/**
 * Eight fictional enquiries across the five pipeline stages, shaped exactly as
 * the public forms store them (`src/app/actions/inquiry.ts`: the form fields
 * minus name/email/phone go into `payload`, the guest's words under `notes`),
 * so a seeded card and a freshly submitted one render the same. Times are
 * relative to now so the board always looks like a live week.
 */
function demoInquiries():Row[] {
 const t=Date.now();const ago=(h:number)=>new Date(t-h*3600e3).toISOString();const day=(d:number)=>venueIsoDate(new Date(t+d*864e5).toISOString());
 const row=(id:number,type:'private-event'|'catering',name:string,handle:string,status:string,createdH:number,movedH:number,payload:Row,plan:{next_step?:string;follow_up_on?:string;notes?:string}={})=>({id:`demo-inquiry-${id}`,reference:`${type==='catering'?'CAT':'EVT'}-DEMO-00${id}`,type,name,email:`${handle}@example.invalid`,phone:`(312) 555-01${String(20+id)}`,status,created_at:ago(createdH),status_changed_at:ago(movedH),payload,next_step:plan.next_step??null,follow_up_on:plan.follow_up_on??null,notes:plan.notes??null});
 return [
  row(1,'private-event','Jamie Morgan','jamie','new',5,5,{eventType:'Rehearsal dinner',date:day(52),guests:24,contactPreference:'phone',notes:'Family-style dinner the night before the wedding. We would love the back room and a welcome aperitivo.'}),
  row(2,'private-event','Nina Alvarez','nina.a','new',43,43,{eventType:'Birthday',date:day(24),dateFlexible:true,guests:18,contactPreference:'text',notes:'My 40th! Dinner for 18, Saturday preferred but Friday works. Can we bring a cake?'}),
  row(3,'private-event','Marcus Webb','mwebb','contacted',98,74,{eventType:'Company dinner',date:day(80),dateFlexible:true,guests:60,contactPreference:'email',notes:'Holiday party for our design studio. Thinking whole-house for about 60, passed plates and a DJ.'},{next_step:'Send whole-house buyout pricing and the December Fridays still open',follow_up_on:day(-1),notes:'Spoke Tuesday. Budget around $95 a head; needs a mic for toasts.'}),
  row(4,'catering','Grace Liu','grace.liu','planning',214,118,{organization:'',date:day(17),time:'11:30am',guests:22,fulfillment:'delivery',packageInterest:'The Sunday Table',notes:'Bridal shower lunch at my sister\u2019s place in Logan Square. Four vegetarians.'},{next_step:'Confirm the vegetarian swap and a 30-minute delivery window',follow_up_on:day(2),notes:'Adding a tiramisu tray. Delivery to a walk-up, second floor.'}),
  row(5,'catering','Theo Brandt','theo','contacted',26,6,{organization:'Northside Pictures',date:day(6),time:'12:30pm',guests:35,fulfillment:'delivery',packageInterest:'By the tray',notes:'Film crew lunch on location, 35 people. Two vegan, one nut allergy.'},{next_step:'Quote trays plus delivery to the set in Pilsen',follow_up_on:day(0)}),
  row(6,'private-event','Sofia Russo','sofia.r','planning',290,190,{eventType:'Engagement celebration',date:day(31),guests:12,contactPreference:'phone',notes:'Surprise engagement dinner for 12. Somewhere a little private for the toast.'},{next_step:'Hold the corner booth and send prosecco toast options',follow_up_on:day(3)}),
  row(7,'private-event','Daniel Okafor','dokafor','booked',620,140,{eventType:'Company dinner',date:day(38),guests:30,contactPreference:'email',notes:'Client dinner for our law firm, 30 guests, seated. We would like wine pairings.'},{next_step:'Final headcount due one week before',follow_up_on:day(31),notes:'Deposit in. Barolo and Vermentino pairing. Two gluten-free.'}),
  row(8,'private-event','Leah Kim','leahk','closed',820,360,{eventType:'Birthday',date:day(10),guests:28,contactPreference:'email',notes:'Surprise party for my partner, around 28 people.'},{notes:'Went with another date: the Saturday they needed was already sold. Offered November; they may come back in spring.'}),
 ];
}
