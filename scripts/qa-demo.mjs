import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const origin=process.env.QA_URL||'http://localhost:3100';
const out=process.env.QA_OUTPUT||'/tmp/cosa-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();
const errors=[];const results=[];
page.on('pageerror',e=>errors.push({route:page.url(),message:e.message}));
page.on('console',m=>{if(m.type()==='error')errors.push({route:page.url(),message:m.text()});});
const routes=['/','/menu','/events','/events/vinyl-vermouth','/events/sunday-supper','/events/after-hours-friday','/events/vinyl-vermouth-session','/private-events','/catering','/careers','/contact','/talent','/reservations','/order','/demo/admin','/admin/menu','/admin/events','/admin/media','/admin/inquiries','/admin/hiring','/admin/emails','/admin/events/demo-vinyl-opening/sales','/demo/staff','/staff/schedule','/staff/training','/staff/availability','/demo/manager','/admin/look','/admin/theme','/admin/website','/admin/settings','/admin/team','/admin/talent','/admin/link-hubs','/admin/door','/admin/scan','/admin/emails/sending','/staff/team','/staff/operations','/staff/announcements','/staff/profile'];
for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const route of routes){
 try{
 const response=await page.goto(origin+route,{waitUntil:'networkidle',timeout:60000});
 await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,40))}scrollTo(0,0)});
 await page.waitForTimeout(200);
 const info=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc),h1:[...document.querySelectorAll('h1')].map(e=>e.textContent)}));
 const result={route,width,status:response.status(),...info};results.push(result);
 if(result.status!==200||info.overflow||info.broken.length)console.log('ISSUE',JSON.stringify(result));
 await page.screenshot({path:`${out}/${width}-${route.replaceAll('/','_')||'home'}.png`,fullPage:true});
 }catch(e){errors.push({route,width,message:e.message});}
}}
await writeFile(`${out}/report.json`,JSON.stringify({origin,results,errors},null,2));
console.log(JSON.stringify({pages:results.length,issues:results.filter(r=>r.status!==200||r.overflow||r.broken.length),errors},null,2));await browser.close();

if(errors.length||results.some(r=>r.status!==200||r.overflow||r.broken.length))process.exitCode=1;
