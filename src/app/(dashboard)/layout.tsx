import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Home, Search, Library, Settings, ShieldAlert, Music, LogOut, Users } from 'lucide-react';
import PlayerInitializer from './PlayerInitializer';
import PersistentPlayer from '@/components/PersistentPlayer';
import LogoutButton from './LogoutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile via Drizzle ORM
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  const isAdmin = profile?.role === 'admin';
  const showVideo = profile?.showVideo ?? false;

  const navItems = [
    { href: '/', label: 'בית', icon: Home },
    { href: '/artists', label: 'אמנים', icon: Users },
    { href: '/search', label: 'חיפוש', icon: Search },
    { href: '/library', label: 'ספרייה', icon: Library },
    { href: '/settings', label: 'הגדרות', icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ href: '/admin', label: 'ניהול', icon: ShieldAlert });
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground flex flex-col md:flex-row pb-36 md:pb-24">
      {/* Initialize Player Settings */}
      <PlayerInitializer showVideo={showVideo} />

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-l border-border h-screen sticky top-0 z-20 p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Music className="h-6 w-6 animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
            מיתרים
          </span>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all duration-200 group"
              >
                <Icon className="h-5 w-5 group-hover:scale-105 transition-transform duration-200" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-4 mt-auto">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <div className="truncate flex-1">
              <p className="text-xs text-muted-foreground">מחובר כעת:</p>
              <p className="text-sm font-medium truncate text-foreground/90">{user.email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Bottom Nav - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border z-30 flex items-center justify-around py-3 px-4 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Icon className="h-5 w-5 group-hover:scale-105 transition-transform" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>

      {/* Persistent global player */}
      <PersistentPlayer />
    </div>
  );
}
