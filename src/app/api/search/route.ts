import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { allowedChannels, blockedKeywords, blockedVideos } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCachedValue, setCachedValue } from '@/utils/cache';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim() === '') {
      return NextResponse.json([]);
    }

    // 1. Fetch user's allowed channels (Whitelist) using Drizzle
    const allowed = await db.select({
      channelId: allowedChannels.channelId,
    })
    .from(allowedChannels)
    .where(eq(allowedChannels.userId, user.id));

    const allowedChannelIds = new Set(allowed.map((ch) => ch.channelId));

    // If the user has no allowed channels, they get empty results immediately
    if (allowedChannelIds.size === 0) {
      return NextResponse.json([]);
    }

    // 2. Fetch user's blacklists (blocked keywords and specific videos)
    const blockedWords = await db.select({
      keyword: blockedKeywords.keyword
    })
    .from(blockedKeywords)
    .where(eq(blockedKeywords.userId, user.id));
    const blockedKeywordsList = blockedWords.map((w) => w.keyword.trim().toLowerCase());

    const blockedVids = await db.select({
      videoId: blockedVideos.videoId
    })
    .from(blockedVideos)
    .where(eq(blockedVideos.userId, user.id));
    const blockedVideoIdsSet = new Set(blockedVids.map((v) => v.videoId));

    // 3. Fetch raw YouTube search results from cache if available
    const cacheKey = `youtube_search_raw:${q.trim().toLowerCase()}`;
    let rawVideos = await getCachedValue<any[]>(cacheKey);

    if (!rawVideos) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'YouTube API not configured' }, { status: 500 });
      }

      // Fetch 50 results to increase matches after whitelist filtering
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(q)}&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchResult = await searchRes.json();

      if (searchResult.error) {
        console.error('YouTube Search API error:', searchResult.error);
        return NextResponse.json({ error: searchResult.error.message }, { status: 400 });
      }

      const items = searchResult.items || [];
      rawVideos = items.map((item: any) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
        channelId: item.snippet?.channelId,
        channelTitle: item.snippet?.channelTitle,
      })).filter((v: any) => v.videoId); // Filter out items without videoId

      // Cache raw search results for 24 hours
      await setCachedValue(cacheKey, rawVideos);
    }

    // 4. Strict Server-Side Filtering: Whitelist + Blacklist check
    const filteredVideos = (rawVideos || []).filter((video) => {
      // Must be in whitelisted channels
      if (!allowedChannelIds.has(video.channelId)) return false;

      // Must not be a blocked video
      if (blockedVideoIdsSet.has(video.videoId)) return false;

      // Must not contain any blocked keyword in the title
      const titleLower = (video.title || '').toLowerCase();
      const hasBlockedWord = blockedKeywordsList.some((word) => titleLower.includes(word));
      if (hasBlockedWord) return false;

      return true;
    });

    return NextResponse.json(filteredVideos);
  } catch (error: any) {
    console.error('Error in Search API: ', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
