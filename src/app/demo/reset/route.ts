import { NextRequest, NextResponse } from 'next/server';
import { DEMO_STATE_PREFIX, DEMO_STATE_CHUNKS } from '@/lib/db/demo-state';
export function GET(request:NextRequest){
 const requested=request.nextUrl.searchParams.get('next');
 const next=requested==='/demo/staff'?requested:'/demo/admin';
 const response=NextResponse.redirect(new URL(next,request.url));
 for(let i=0;i<DEMO_STATE_CHUNKS;i++)response.cookies.delete(`${DEMO_STATE_PREFIX}${i}`);
 return response;
}
