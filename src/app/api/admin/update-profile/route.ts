import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
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

    // Verify admin status
    const adminProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, currentUser.id),
    });

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, showVideo, role } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (showVideo !== undefined) updateData.showVideo = showVideo;
    if (role !== undefined) updateData.role = role;
    updateData.updatedAt = new Date();

    await db.update(profiles)
      .set(updateData)
      .where(eq(profiles.id, userId));

    // If changing role, sync with Auth user metadata so it takes effect in the JWT session instantly
    if (role !== undefined) {
      const { createAdminClient } = await import('@/utils/supabase/admin');
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { role }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating profile: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
