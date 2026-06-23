import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { playlists } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import LibraryClient from './LibraryClient';

export const revalidate = 0; // Fresh playlist state on page load

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch initial playlists via Drizzle ORM
  const list = await db.select()
    .from(playlists)
    .where(eq(playlists.userId, user.id))
    .orderBy(desc(playlists.createdAt));

  // Map to local component interface format
  const initialPlaylists = list.map((item) => ({
    id: item.id,
    name: item.name,
    createdAt: item.createdAt.toISOString(),
  }));

  return <LibraryClient initialPlaylists={initialPlaylists} />;
}
