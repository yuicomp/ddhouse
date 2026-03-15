import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gasUrl = searchParams.get('gasUrl');
  if (!gasUrl) return NextResponse.json({ success: false, error: 'gasUrl is required' }, { status: 400 });

  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'gasUrl') params.set(key, value);
  });

  try {
    const res = await fetch(`${gasUrl}?${params.toString()}`, { redirect: 'follow' });
    const text = await res.text();
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { gasUrl, ...rest } = body;

  if (!gasUrl) return NextResponse.json({ success: false, error: 'gasUrl is required' }, { status: 400 });

  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
      redirect: 'follow',
    });
    const text = await res.text();
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
