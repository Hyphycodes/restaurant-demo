import { NextResponse, type NextRequest } from 'next/server';
import { PRESETS, resolveLook, type PresetName } from '@/lib/appearance/presets';
import { getStaff } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The variables a preset emits, for the thumbnail script. Staff only. */
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({}, { status: 401 });
  const preset = request.nextUrl.searchParams.get('preset') ?? 'evening';
  if (!(PRESETS as readonly string[]).includes(preset)) return NextResponse.json({}, { status: 400 });
  return NextResponse.json(resolveLook({ preset: preset as PresetName, surfaceHex: null, accentHex: null }).vars);
}
