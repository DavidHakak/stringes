import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { playlists, playlistItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET: Fetch all items for a playlist
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');

    if (!playlistId) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
    }

    // Verify user owns the target playlist
    const targetPlaylist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.id, playlistId),
        eq(playlists.userId, user.id)
      ),
    });

    if (!targetPlaylist) {
      return NextResponse.json({ error: 'Playlist not found or access denied' }, { status: 404 });
    }

    const items = await db.select()
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId));

    // Map DB schema keys to camelCase for the frontend
    const mappedItems = items.map(item => ({
      id: item.id,
      playlistId: item.playlistId,
      videoId: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail || '',
    }));

    return NextResponse.json(mappedItems);
  } catch (error: any) {
    console.error('Error fetching playlist items: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Add a song to a playlist
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playlistId, videoId, title, thumbnail } = await request.json();

    if (!playlistId || !videoId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user owns the target playlist
    const targetPlaylist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.id, playlistId),
        eq(playlists.userId, user.id)
      ),
    });

    if (!targetPlaylist) {
      return NextResponse.json({ error: 'Playlist not found or access denied' }, { status: 404 });
    }

    // Check if song already exists in the playlist to prevent duplicates
    const existingItem = await db.query.playlistItems.findFirst({
      where: and(
        eq(playlistItems.playlistId, playlistId),
        eq(playlistItems.videoId, videoId)
      ),
    });

    if (existingItem) {
      return NextResponse.json({ error: 'השיר כבר קיים ברשימת ההשמעה הזו' }, { status: 409 });
    }

    const [newItem] = await db.insert(playlistItems)
      .values({
        playlistId,
        videoId,
        title,
        thumbnail,
      })
      .returning();

    return NextResponse.json(newItem);
  } catch (error: any) {
    console.error('Error adding playlist item: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Remove a song from a playlist
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playlistId, videoId } = await request.json();

    if (!playlistId || !videoId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user owns the target playlist
    const targetPlaylist = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.id, playlistId),
        eq(playlists.userId, user.id)
      ),
    });

    if (!targetPlaylist) {
      return NextResponse.json({ error: 'Playlist not found or access denied' }, { status: 404 });
    }

    await db.delete(playlistItems)
      .where(
        and(
          eq(playlistItems.playlistId, playlistId),
          eq(playlistItems.videoId, videoId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting playlist item: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
