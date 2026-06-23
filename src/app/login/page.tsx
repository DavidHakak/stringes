'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Music, Eye, EyeOff, Lock, Mail, User, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              role: 'user', // DB trigger will promote first user to 'admin'
            },
          },
        });

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg('נרשמת בהצלחה! כעת תוכל להתחבר למערכת עם פרטיך.');
          setIsSignUp(false); // Switch back to login
          setName('');
        }
      } else {
        // Login Flow
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message === 'Invalid login credentials') {
            setErrorMsg('פרטי ההתחברות שגויים, אנא נסה שנית');
          } else if (error.message.toLowerCase().includes('confirm') || error.message.toLowerCase().includes('not confirmed')) {
            setErrorMsg('חשבונך עדיין לא אושר. אנא היכנס לתיבת המייל שלך ולחץ על קישור האישור שנשלח אליך (שים לב לבדוק גם בתיקיית ספאם/דואר זבל).');
          } else {
            setErrorMsg(error.message);
          }
        } else {
          router.refresh();
          router.push('/');
        }
      }
    } catch (err) {
      setErrorMsg('אירעה שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg('אנא הזן תחילה את כתובת האימייל שלך לשחזור הסיסמה');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('קישור לאיפוס סיסמה נשלח לתיבת המייל שלך');
      }
    } catch (err) {
      setErrorMsg('אירעה שגיאה בשליחת קישור האיפוס');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />

      <div className="w-full max-w-md space-y-8 z-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Music className="h-8 w-8 animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            מיתרים
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            נגן מוזיקה משפחתי מסונן ומבוקר לכל המשפחה
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-md border border-border/80 rounded-2xl p-8 shadow-xl">
          <form className="space-y-6" onSubmit={handleAuth}>
            <div className="border-b border-border/40 pb-4 mb-4 flex justify-around text-sm font-semibold">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setErrorMsg(null); setSuccessMsg(null); }}
                className={`pb-2 px-4 transition-all focus:outline-none ${!isSignUp ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
              >
                התחברות
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setErrorMsg(null); setSuccessMsg(null); }}
                className={`pb-2 px-4 transition-all focus:outline-none ${isSignUp ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
              >
                הרשמה למערכת
              </button>
            </div>

            {errorMsg && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 text-center font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg p-3 text-center font-medium">
                {successMsg}
              </div>
            )}

            <div className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    שם מלא
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pr-10 pl-3 py-2.5 bg-secondary/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-muted-foreground text-sm"
                      placeholder="ישראל ישראלי"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  כתובת אימייל
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pr-10 pl-3 py-2.5 bg-secondary/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-muted-foreground text-sm"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  סיסמה
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pr-10 pl-10 py-2.5 bg-secondary/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-muted-foreground text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-primary hover:text-primary/80 transition-colors focus:outline-none"
                >
                  שכחת את הסיסמה?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  טוען...
                </>
              ) : isSignUp ? (
                'הרשם למערכת'
              ) : (
                'התחבר למערכת'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
