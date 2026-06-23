import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { allowedChannels, profiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET: Fetch allowed channels for a specific user
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || currentUser.id;

    // If fetching for someone else, verify requester is admin
    if (userId !== currentUser.id) {
      const requesterProfile = await db.query.profiles.findFirst({
        where: eq(profiles.id, currentUser.id),
      });
      if (requesterProfile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const channels = await db.select()
      .from(allowedChannels)
      .where(eq(allowedChannels.userId, userId));

    return NextResponse.json(channels);
  } catch (error: any) {
    console.error('Error in GET whitelist: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Add a channel to a user's whitelist
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const requesterProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, currentUser.id),
    });
    if (requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, channelId, channelTitle, channelThumbnail } = await request.json();

    if (!userId || !channelId || !channelTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert into allowedChannels using Drizzle ORM
    await db.insert(allowedChannels)
      .values({
        userId,
        channelId,
        channelTitle,
        channelThumbnail,
      })
      .onConflictDoNothing(); // Prevent duplicate inserts

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST whitelist: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Remove a channel from a user's whitelist
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const requesterProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, currentUser.id),
    });
    if (requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, channelId } = await request.json();

    if (!userId || !channelId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await db.delete(allowedChannels)
      .where(
        and(
          eq(allowedChannels.userId, userId),
          eq(allowedChannels.channelId, channelId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE whitelist: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
