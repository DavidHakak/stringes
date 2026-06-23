import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify current user is admin
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
    });
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    // Secure re-verification using Supabase Auth
    const testClient = await createClient();
    const { error } = await testClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (error) {
      return NextResponse.json({ verified: false, error: 'סיסמה שגויה' });
    }

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
