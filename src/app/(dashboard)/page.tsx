import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { allowedChannels, playHistory, profiles, blockedKeywords, blockedVideos } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCachedValue, setCachedValue } from '@/utils/cache';
import HomeClient from './HomeClient';
import { Track } from '@/store/usePlayerStore';

export const revalidate = 60; // Cache this server response for 60 seconds

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch user profile using Drizzle
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'משתמש';

  // 2. Fetch play history using Drizzle
  const rawHistory = await db.select()
    .from(playHistory)
    .where(eq(playHistory.userId, user.id))
    .orderBy(desc(playHistory.playedAt))
    .limit(8);

  const recentTracks: Track[] = rawHistory.map((item) => ({
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail || '',
    channelTitle: 'הושמע לאחרונה',
  }));

  // 3. Fetch user's whitelisted channels
  const whitelisted = await db.select()
    .from(allowedChannels)
    .where(eq(allowedChannels.userId, user.id));

  const recommendedTracks: Track[] = [];

  if (whitelisted.length > 0) {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (apiKey) {
      // Fetch latest videos for each whitelisted channel
      const fetchPromises = whitelisted.map(async (channel) => {
        const cacheKey = `youtube_channel_feed_v2:${channel.channelId}`;
        let videos = await getCachedValue<Track[]>(cacheKey);

        if (!videos) {
          try {
            // Search for top 15 videos in this channel, sorted by date
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&order=date&channelId=${channel.channelId}&key=${apiKey}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.items) {
              videos = data.items.map((item: any) => ({
                videoId: item.id?.videoId,
                title: item.snippet?.title,
                thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
                channelId: channel.channelId,
                channelTitle: channel.channelTitle,
              })).filter((v: any) => v.videoId);

              // Cache channel feed for 24 hours
              await setCachedValue(cacheKey, videos);
            } else {
              videos = [];
            }
          } catch (e) {
            console.error(`Failed to fetch feed for channel ${channel.channelId}:`, e);
            videos = [];
          }
        }
        return videos;
      });

      const feeds = await Promise.all(fetchPromises);
      feeds.forEach((feed) => {
        if (feed) recommendedTracks.push(...feed);
      });

      // 4. Fetch blacklist and apply it
      const blockedWords = await db.select()
        .from(blockedKeywords)
        .where(eq(blockedKeywords.userId, user.id));
      const blockedKeywordsList = blockedWords.map((w) => w.keyword.trim().toLowerCase());

      const blockedVids = await db.select()
        .from(blockedVideos)
        .where(eq(blockedVideos.userId, user.id));
      const blockedVideoIdsSet = new Set(blockedVids.map((v) => v.videoId));

      const filteredRecommended = recommendedTracks.filter((track) => {
        if (blockedVideoIdsSet.has(track.videoId)) return false;
        const titleLower = (track.title || '').toLowerCase();
        return !blockedKeywordsList.some((word) => titleLower.includes(word));
      });

      // Shuffle recommended tracks to give a mixed experience
      filteredRecommended.sort(() => Math.random() - 0.5);
      recommendedTracks.length = 0;
      recommendedTracks.push(...filteredRecommended);
    } else {
      console.error('YOUTUBE_API_KEY is not defined');
    }
  }

  return (
    <HomeClient
      recentTracks={recentTracks}
      recommendedTracks={recommendedTracks.slice(0, 100)} // Top 100 mixed tracks
      userName={userName}
    />
  );
}
