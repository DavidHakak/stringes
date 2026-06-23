import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { 
  Settings, User, Video, VideoOff, Smartphone, Shield, CheckCircle, 
  HelpCircle, ArrowLeft
} from 'lucide-react';
import LogoutButton from '../LogoutButton';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile via Drizzle ORM
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  const userName = user.user_metadata?.name || 'משתמש ללא שם';
  const roleText = profile?.role === 'admin' ? 'מנהל מערכת (Admin)' : 'משתמש קצה (User)';
  const videoPermission = profile?.showVideo ?? false;

  return (
    <div dir="rtl" className="space-y-8 pb-10 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <Settings className="h-8 w-8 text-primary" />
          הגדרות חשבון
        </h1>
        <p className="text-muted-foreground text-sm mt-1">פרטי פרופיל והוראות התקנת אפליקציית PWA</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card (Col 1) */}
        <div className="md:col-span-1 bg-card/40 border border-border/80 rounded-2xl p-6 shadow-md backdrop-blur-md space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4 border border-primary/20">
              <User className="h-10 w-10" />
            </div>
            <h2 className="text-lg font-bold text-foreground">{userName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>

          <div className="border-t border-border/50 pt-4 space-y-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">תפקיד:</span>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                {roleText}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">סטטוס וידאו:</span>
              <span className={`font-semibold flex items-center gap-1.5 ${
                videoPermission ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {videoPermission ? (
                  <>
                    <Video className="h-4 w-4" />
                    וידאו פתוח
                  </>
                ) : (
                  <>
                    <VideoOff className="h-4 w-4" />
                    אודיו בלבד (חסום)
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-xl">
              <span className="text-xs text-muted-foreground">התנתק מהחשבון</span>
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* PWA Info Card (Col 2 & 3) */}
        <div className="md:col-span-2 bg-card/40 border border-border/80 rounded-2xl p-6 shadow-md backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2.5 mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">התקנת אפליקציה בנייד (PWA)</h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            אפליקציה זו מותאמת כ-**Progressive Web App (PWA)**, מה שמאפשר לך להתקין אותה על גבי הטלפון או הטאבלט שלך ולהאזין למוזיקה במסך מלא ללא שורת הכתובת של הדפדפן, בדיוק כמו אפליקציה רגילה (Native).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* iOS */}
            <div className="bg-secondary/25 border border-border/40 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center">1</span>
                התקנה ב-iPhone ו-iPad (Safari)
              </h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside pr-1">
                <li>פתח את האפליקציה בדפדפן **Safari**.</li>
                <li>הקש על כפתור **"שתף"** (האייקון של הריבוע עם החץ למעלה).</li>
                <li>גלול מטה ובחר באפשרות **"הוסף למסך הבית"** (Add to Home Screen).</li>
                <li>הקש על **"הוסף"** בפינה העליונה.</li>
              </ol>
            </div>

            {/* Android */}
            <div className="bg-secondary/25 border border-border/40 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center">2</span>
                התקנה ב-Android (Chrome)
              </h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside pr-1">
                <li>פתח את האפליקציה בדפדפן **Chrome**.</li>
                <li>הקש על **שלוש הנקודות** בפינה העליונה של המסך.</li>
                <li>בחר באפשרות **"התקן אפליקציה"** או **"הוסף למסך הבית"**.</li>
                <li>אשר את ההודעה שתופיע על המסך.</li>
              </ol>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 text-xs text-muted-foreground leading-relaxed">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <strong className="text-foreground font-semibold">לאחר ההוספה:</strong> האפליקציה תופיע כקיצור דרך עם האייקון של מיתרים במסך הבית שלך. לחיצה עליו תפתח אותה במסך מלא לחלוטין.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
