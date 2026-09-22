'use client';
import Link from 'next/link';
import { useState } from 'react';

/** Simulates the door workflow without a camera, payment provider or live ticket token. */
export function DemoScanner({ eventTitle }: { eventTitle:string }) {
  const [checked,setChecked]=useState(false);
  const [result,setResult]=useState<'valid'|'duplicate'|'invalid'|null>(null);
  return <main className="min-h-dvh bg-[#1d1511] px-5 py-10 text-[#f2ebdf]"><div className="mx-auto max-w-lg">
    <Link href="/admin/door" className="text-sm underline underline-offset-4">← Door overview</Link>
    <p className="mt-10 text-xs uppercase tracking-[.18em] text-[#d4b88a]">Demo Workspace · Door scanner</p>
    <h1 className="display mt-3 text-4xl">{eventTitle}</h1>
    <p className="mt-4 leading-relaxed text-[#d2c2b2]">Try the arrival experience with fictional tickets. No camera or real guest data is used.</p>
    <div className="my-8 rounded-xl border border-[#d4b88a]/30 p-6"><p className="text-sm">Checked in</p><p className="display mt-2 text-5xl">{checked?7:6} <span className="text-2xl text-[#d2c2b2]">of 18</span></p></div>
    <div className="grid gap-3"><button onClick={()=>{setResult(checked?'duplicate':'valid');setChecked(true)}} className="min-h-14 rounded bg-[#e0c394] px-5 py-3 font-semibold text-[#241b19]">Scan sample ticket · Jamie Morgan</button><button onClick={()=>setResult('invalid')} className="min-h-14 rounded border border-[#d4b88a]/40 px-5 py-3">Try a ticket for a different event</button></div>
    {result?<div role="status" className={`mt-6 rounded-xl border p-6 ${result==='valid'?'border-emerald-400 bg-emerald-950':result==='duplicate'?'border-amber-400 bg-amber-950':'border-rose-400 bg-rose-950'}`}><h2 className="text-2xl font-semibold">{result==='valid'?'Welcome in.':result==='duplicate'?'Already checked in.':'Wrong evening.'}</h2><p className="mt-2">{result==='valid'?'Jamie Morgan · Supper Club Admission · 1 guest':result==='duplicate'?'This sample ticket has already been used. A manager can review the arrival.':'This sample ticket belongs to another event. Please check the event date.'}</p></div>:null}
    <button className="mt-8 text-sm underline underline-offset-4" onClick={()=>{setChecked(false);setResult(null)}}>Reset sample arrivals</button>
  </div></main>;
}
