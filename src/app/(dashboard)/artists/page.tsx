import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { allowedChannels, blockedKeywords, blockedVideos } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCachedValue, setCachedValue } from '@/utils/cache';
import { Track } from '@/store/usePlayerStore';
import ArtistsClient from './ArtistsClient';

export const revalidate = 60; // Cache page for 60s

interface Artist {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  tracks: Track[];
}

export default async function ArtistsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch user's whitelisted channels (artists)
  const whitelisted = await db.select()
    .from(allowedChannels)
    .where(eq(allowedChannels.userId, user.id));

  // 2. Fetch user's blacklists
  const blockedWords = await db.select()
    .from(blockedKeywords)
    .where(eq(blockedKeywords.userId, user.id));
  const blockedKeywordsList = blockedWords.map((w) => w.keyword.trim().toLowerCase());

  const blockedVids = await db.select()
    .from(blockedVideos)
    .where(eq(blockedVideos.userId, user.id));
  const blockedVideoIdsSet = new Set(blockedVids.map((v) => v.videoId));

  const artists: Artist[] = [];

  if (whitelisted.length > 0) {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (apiKey) {
      // 3. Fetch latest 10 videos for each whitelisted channel
      const fetchPromises = whitelisted.map(async (channel) => {
        const cacheKey = `youtube_channel_artists_feed_v1:${channel.channelId}`;
        let videos = await getCachedValue<Track[]>(cacheKey);

        if (!videos) {
          try {
            // Search for top 10 videos in this channel, sorted by date
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&order=date&channelId=${channel.channelId}&key=${apiKey}`;
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

              // Cache feed for 24 hours
              await setCachedValue(cacheKey, videos);
            } else {
              videos = [];
            }
          } catch (e) {
            console.error(`Failed to fetch feed for artist ${channel.channelId}:`, e);
            videos = [];
          }
        }

        // Apply blacklist filtering
        const filteredVideos = (videos || []).filter((track) => {
          if (blockedVideoIdsSet.has(track.videoId)) return false;
          const titleLower = (track.title || '').toLowerCase();
          return !blockedKeywordsList.some((word) => titleLower.includes(word));
        });

        return {
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          channelThumbnail: channel.channelThumbnail || '',
          tracks: filteredVideos,
        };
      });

      const results = await Promise.all(fetchPromises);
      artists.push(...results);
    } else {
      console.error('YOUTUBE_API_KEY is not defined');
    }
  }

  return <ArtistsClient artists={artists} />;
}
