import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify current user is admin via Drizzle ORM
    const userProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, currentUser.id),
    });

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    
    // Create user with admin privileges (bypass email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'user', name },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const newUser = authData.user;
    if (newUser) {
      // Ensure profile row exists (trigger should handle it, but Drizzle guarantees it)
      await db.insert(profiles)
        .values({
          id: newUser.id,
          role: 'user',
          showVideo: false,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { updatedAt: new Date() }
        });
    }

    return NextResponse.json({ success: true, userId: newUser?.id });
  } catch (error: any) {
    console.error('Error creating user: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
