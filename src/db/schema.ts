import { pgTable, uuid, text, boolean, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';

// User profiles connected to Supabase auth.users
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().notNull(), // Linked to auth.users.id
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  showVideo: boolean('show_video').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Approved YouTube channels for each user (Whitelist)
export const allowedChannels = pgTable('allowed_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // Profiles id
  channelId: text('channel_id').notNull(),
  channelTitle: text('channel_title').notNull(),
  channelThumbnail: text('channel_thumbnail'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userChannelUnique: unique('user_channel_unique').on(t.userId, t.channelId),
}));

// Playlists created by users
export const playlists = pgTable('playlists', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Songs inside a playlist
export const playlistItems = pgTable('playlist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  playlistId: uuid('playlist_id').notNull(), // Playlists id
  videoId: text('video_id').notNull(),
  title: text('title').notNull(),
  thumbnail: text('thumbnail'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Cache for YouTube search and channel query results
export const youtubeCache = pgTable('youtube_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// Play history (recent plays)
export const playHistory = pgTable('play_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  videoId: text('video_id').notNull(),
  title: text('title').notNull(),
  thumbnail: text('thumbnail'),
  playedAt: timestamp('played_at', { withTimezone: true }).defaultNow().notNull(),
});
