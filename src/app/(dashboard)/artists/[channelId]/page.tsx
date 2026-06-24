import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { allowedChannels, blockedKeywords, blockedVideos } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCachedValue, setCachedValue } from '@/utils/cache';
import { Track } from '@/store/usePlayerStore';
import ArtistDetailClient from './ArtistDetailClient';

export const revalidate = 60; // Cache page for 60s

interface PageProps {
  params: Promise<{ channelId: string }>;
}

export default async function ArtistDetailPage({ params }: PageProps) {
  const { channelId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch user's whitelisted channel matching the channelId
  const whitelisted = await db.select()
    .from(allowedChannels)
    .where(
      and(
        eq(allowedChannels.userId, user.id),
        eq(allowedChannels.channelId, channelId)
      )
    )
    .limit(1);

  if (whitelisted.length === 0) {
    // If this channel is not in the user's whitelist, redirect to artists page
    redirect('/artists');
  }

  const channel = whitelisted[0];

  // 2. Fetch user's blacklists
  const blockedWords = await db.select()
    .from(blockedKeywords)
    .where(eq(blockedKeywords.userId, user.id));
  const blockedKeywordsList = blockedWords.map((w) => w.keyword.trim().toLowerCase());

  const blockedVids = await db.select()
    .from(blockedVideos)
    .where(eq(blockedVideos.userId, user.id));
  const blockedVideoIdsSet = new Set(blockedVids.map((v) => v.videoId));

  // 3. Fetch latest 50 videos for this whitelisted channel
  const apiKey = process.env.YOUTUBE_API_KEY;
  let tracks: Track[] = [];

  if (apiKey) {
    const cacheKey = `youtube_channel_artists_all_v1:${channelId}`;
    let videos = await getCachedValue<Track[]>(cacheKey);

    if (!videos) {
      try {
        // Search for top 50 videos in this channel, sorted by date
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&order=date&channelId=${channelId}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.items) {
          videos = data.items.map((item: any) => ({
            videoId: item.id?.videoId,
            title: item.snippet?.title,
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
            channelId: channelId,
            channelTitle: channel.channelTitle,
          })).filter((v: any) => v.videoId);

          // Cache full feed for 24 hours
          await setCachedValue(cacheKey, videos);
        } else {
          videos = [];
        }
      } catch (e) {
        console.error(`Failed to fetch all videos for artist ${channelId}:`, e);
        videos = [];
      }
    }

    // Apply blacklist filtering
    tracks = (videos || []).filter((track) => {
      if (blockedVideoIdsSet.has(track.videoId)) return false;
      const titleLower = (track.title || '').toLowerCase();
      return !blockedKeywordsList.some((word) => titleLower.includes(word));
    });
  } else {
    console.error('YOUTUBE_API_KEY is not defined');
  }

  return (
    <ArtistDetailClient
      channelTitle={channel.channelTitle}
      channelThumbnail={channel.channelThumbnail || ''}
      tracks={tracks}
    />
  );
}
