import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import AdminDashboardClient from './AdminDashboardClient';

export const revalidate = 0; // Disable server caching for admin page to get fresh user list

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect('/login');
  }

  // Double check admin role via Drizzle ORM
  const currentProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, currentUser.id),
  });

  if (currentProfile?.role !== 'admin') {
    redirect('/');
  }

  // Fetch all users from Supabase Auth via Admin Client
  const supabaseAdmin = createAdminClient();
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    console.error('Error listing auth users:', error);
  }

  // Fetch all profiles from Drizzle DB
  const userProfiles = await db.select().from(profiles);

  // Map auth users with their profile data
  const mappedUsers = (users || []).map((user) => {
    const profile = userProfiles.find((p) => p.id === user.id);
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || 'משתמש ללא שם',
      role: profile?.role || 'user',
      showVideo: profile?.showVideo ?? false,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">לוח בקרת מנהל</h1>
          <p className="text-muted-foreground text-sm mt-1">ניהול חשבונות משתמשים, ערוצים מאושרים והרשאות צפייה</p>
        </div>
      </div>

      <AdminDashboardClient initialUsers={mappedUsers} />
    </div>
  );
}
