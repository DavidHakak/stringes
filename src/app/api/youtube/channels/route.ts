import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getCachedValue, setCachedValue } from '@/utils/cache';
import { db } from '@/db';
import { blockedKeywords } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const targetUserId = searchParams.get('userId');

    if (!q || q.trim() === '') {
      return NextResponse.json([]);
    }

    // Pre-check if search query contains any blocked keywords for this user profile to save YouTube API tokens
    const userIdToCheck = targetUserId || user.id;
    const blockedWords = await db.select({
      keyword: blockedKeywords.keyword
    })
    .from(blockedKeywords)
    .where(eq(blockedKeywords.userId, userIdToCheck));

    const blockedKeywordsList = blockedWords.map((w) => w.keyword.trim().toLowerCase());
    const qLower = q.trim().toLowerCase();
    const isQueryBlocked = blockedKeywordsList.some((word) => qLower.includes(word));
    if (isQueryBlocked) {
      return NextResponse.json([]);
    }

    const cacheKey = `youtube_channels:${q.trim().toLowerCase()}`;
    const cachedData = await getCachedValue<any[]>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('YOUTUBE_API_KEY is not defined in env');
      return NextResponse.json({ error: 'YouTube API not configured' }, { status: 500 });
    }

    // 1. Search for channels
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=10&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchResult = await searchRes.json();

    if (searchResult.error) {
      console.error('YouTube Search API error:', searchResult.error);
      return NextResponse.json({ error: searchResult.error.message }, { status: 400 });
    }

    const items = searchResult.items || [];
    if (items.length === 0) {
      await setCachedValue(cacheKey, []);
      return NextResponse.json([]);
    }

    // Extract channel IDs to get full stats (subscriber count)
    const channelIds = items.map((item: any) => item.snippet.channelId).join(',');

    // 2. Fetch subscriber counts and detailed snippets
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds}&key=${apiKey}`;
    const channelsRes = await fetch(channelsUrl);
    const channelsResult = await channelsRes.json();

    if (channelsResult.error) {
      console.error('YouTube Channels API error:', channelsResult.error);
      return NextResponse.json({ error: channelsResult.error.message }, { status: 400 });
    }

    const channelDetails = channelsResult.items || [];

    // Map channels into clean UI objects
    const channels = channelDetails.map((channel: any) => ({
      channelId: channel.id,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.medium?.url,
      subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
      description: channel.snippet.description
    }));

    // Cache results for 24 hours
    await setCachedValue(cacheKey, channels);

    return NextResponse.json(channels);
  } catch (error: any) {
    console.error('Error in youtube/channels API: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
