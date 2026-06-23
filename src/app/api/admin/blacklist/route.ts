import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { blockedKeywords, blockedVideos, profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    const keywords = await db.select().from(blockedKeywords).where(eq(blockedKeywords.userId, targetUserId));
    const videos = await db.select().from(blockedVideos).where(eq(blockedVideos.userId, targetUserId));

    return NextResponse.json({ keywords, videos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { targetUserId, type, keyword, videoId, videoTitle } = body;

    if (!targetUserId || !type) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (type === 'keyword') {
      if (!keyword || keyword.trim() === '') {
        return NextResponse.json({ error: 'Keyword required' }, { status: 400 });
      }

      const [inserted] = await db.insert(blockedKeywords).values({
        userId: targetUserId,
        keyword: keyword.trim(),
      }).returning();

      return NextResponse.json(inserted);
    } else if (type === 'video') {
      if (!videoId || !videoTitle) {
        return NextResponse.json({ error: 'videoId and videoTitle required' }, { status: 400 });
      }

      const [inserted] = await db.insert(blockedVideos).values({
        userId: targetUserId,
        videoId: videoId.trim(),
        title: videoTitle.trim(),
      }).returning();

      return NextResponse.json(inserted);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (type === 'keyword') {
      await db.delete(blockedKeywords).where(eq(blockedKeywords.id, id));
    } else if (type === 'video') {
      await db.delete(blockedVideos).where(eq(blockedVideos.id, id));
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
