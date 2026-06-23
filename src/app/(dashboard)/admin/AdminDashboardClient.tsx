'use client';

import { useState, useEffect } from 'react';
import { 
  UserPlus, Search, Shield, Video, VideoOff, Trash2, 
  Plus, Check, Loader2, ListFilter, Users, RefreshCw, X, Lock
} from 'lucide-react';

interface MappedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  showVideo: boolean;
}

interface WhitelistedChannel {
  id: string;
  userId: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
}

interface BlockedKeyword {
  id: string;
  userId: string;
  keyword: string;
}

interface BlockedVideo {
  id: string;
  userId: string;
  videoId: string;
  title: string;
}

interface YouTubeChannelSearchResult {
  channelId: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  description: string;
}

export default function AdminDashboardClient({ initialUsers }: { initialUsers: MappedUser[] }) {
  const [users, setUsers] = useState<MappedUser[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<MappedUser | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistedChannel[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);

  // Password Lock state
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Tab State for right panel
  const [activeTab, setActiveTab] = useState<'whitelist' | 'blacklist'>('whitelist');

  // Blacklist state
  const [blockedKeywordsList, setBlockedKeywordsList] = useState<BlockedKeyword[]>([]);
  const [blockedVideosList, setBlockedVideosList] = useState<BlockedVideo[]>([]);
  const [loadingBlacklist, setLoadingBlacklist] = useState(false);

  // Blacklist input states
  const [keywordInput, setKeywordInput] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [videoIdInput, setVideoIdInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // YouTube Channel Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeChannelSearchResult[]>([]);
  const [searchingChannels, setSearchingChannels] = useState(false);

  // Debounced search for YouTube channels
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchingChannels(true);
      try {
        const res = await fetch(`/api/youtube/channels?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSearchingChannels(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Load Whitelist and Blacklist when selected user changes
  useEffect(() => {
    if (!selectedUser) {
      setWhitelist([]);
      setBlockedKeywordsList([]);
      setBlockedVideosList([]);
      return;
    }

    const fetchWhitelist = async () => {
      setLoadingWhitelist(true);
      try {
        const res = await fetch(`/api/admin/whitelist?userId=${selectedUser.id}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setWhitelist(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingWhitelist(false);
      }
    };

    const fetchBlacklist = async () => {
      setLoadingBlacklist(true);
      try {
        const res = await fetch(`/api/admin/blacklist?userId=${selectedUser.id}`);
        const data = await res.json();
        if (data && !data.error) {
          setBlockedKeywordsList(data.keywords);
          setBlockedVideosList(data.videos);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBlacklist(false);
      }
    };

    // Reset inputs and tab
    setKeywordInput('');
    setVideoIdInput('');
    setVideoTitleInput('');
    setActiveTab('whitelist');

    fetchWhitelist();
    fetchBlacklist();
  }, [selectedUser]);

  // Handle new user creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateError(null);
    setCreateSuccess(false);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setCreateError(data.error);
      } else {
        setCreateSuccess(true);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        
        // Add new user to local list
        const newUser: MappedUser = {
          id: data.userId,
          email: newUserEmail,
          name: newUserName,
          role: 'user',
          showVideo: false,
        };
        setUsers([...users, newUser]);
      }
    } catch (err) {
      setCreateError('שגיאה בחיבור לשרת');
    } finally {
      setCreatingUser(false);
    }
  };

  // Toggle Video Playing Permissions
  const handleToggleVideo = async (userId: string, currentShowVideo: boolean) => {
    const updatedShowVideo = !currentShowVideo;
    
    // Optimistic Update
    setUsers(users.map((u) => u.id === userId ? { ...u, showVideo: updatedShowVideo } : u));
    if (selectedUser?.id === userId) {
      setSelectedUser({ ...selectedUser, showVideo: updatedShowVideo });
    }

    try {
      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          showVideo: updatedShowVideo,
        }),
      });
      const data = await res.json();
      if (data.error) {
        // Rollback on error
        setUsers(users.map((u) => u.id === userId ? { ...u, showVideo: currentShowVideo } : u));
        if (selectedUser?.id === userId) {
          setSelectedUser({ ...selectedUser, showVideo: currentShowVideo });
        }
        alert(`שגיאה בעדכון הרשאות וידאו: ${data.error}`);
      }
    } catch (e) {
      // Rollback
      setUsers(users.map((u) => u.id === userId ? { ...u, showVideo: currentShowVideo } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, showVideo: currentShowVideo });
      }
      alert('שגיאה בחיבור לשרת');
    }
  };

  // Add Channel to Selected User Whitelist
  const handleAddChannel = async (channel: YouTubeChannelSearchResult) => {
    if (!selectedUser) return;

    // Check if already exists in whitelist
    if (whitelist.some((w) => w.channelId === channel.channelId)) {
      return;
    }

    const tempId = Math.random().toString();
    const newChannel: WhitelistedChannel = {
      id: tempId,
      userId: selectedUser.id,
      channelId: channel.channelId,
      channelTitle: channel.title,
      channelThumbnail: channel.thumbnail,
    };

    // Optimistic Update
    setWhitelist([...whitelist, newChannel]);

    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          channelId: channel.channelId,
          channelTitle: channel.title,
          channelThumbnail: channel.thumbnail,
        }),
      });
      const data = await res.json();
      if (data.error) {
        // Rollback
        setWhitelist(whitelist.filter((w) => w.channelId !== channel.channelId));
        alert(`שגיאה בהוספת הערוץ: ${data.error}`);
      }
    } catch (e) {
      setWhitelist(whitelist.filter((w) => w.channelId !== channel.channelId));
      alert('שגיאה בחיבור לשרת');
    }
  };

  // Remove Channel from Whitelist
  const handleRemoveChannel = async (channelId: string) => {
    if (!selectedUser) return;

    const removedItem = whitelist.find((w) => w.channelId === channelId);
    if (!removedItem) return;

    // Optimistic Update
    setWhitelist(whitelist.filter((w) => w.channelId !== channelId));

    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          channelId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        // Rollback
        setWhitelist([...whitelist, removedItem]);
        alert(`שגיאה בהסרת הערוץ: ${data.error}`);
      }
    } catch (e) {
      setWhitelist([...whitelist, removedItem]);
      alert('שגיאה בחיבור לשרת');
    }
  };

  // Extract Video ID from URL or return the ID itself
  const extractVideoId = (urlOrId: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlOrId.match(regExp);
    return (match && match[2].length === 11) ? match[2] : urlOrId.trim();
  };

  // Handle password lock verification
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingPassword(true);
    setPasswordError(null);
    try {
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (data.verified) {
        setIsPasswordVerified(true);
      } else {
        setPasswordError(data.error || 'סיסמה שגויה');
      }
    } catch (err) {
      setPasswordError('שגיאה בתקשורת עם השרת');
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Add Blocked Keyword
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !keywordInput.trim()) return;

    const keywordNormalized = keywordInput.trim().toLowerCase();
    if (blockedKeywordsList.some((kw) => kw.keyword.toLowerCase() === keywordNormalized)) {
      alert('מילת מפתח זו כבר חסומה למשתמש זה.');
      return;
    }

    setAddingKeyword(true);
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          type: 'keyword',
          keyword: keywordInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`שגיאה בחסימת מילת המפתח: ${data.error}`);
      } else {
        setBlockedKeywordsList([
          ...blockedKeywordsList,
          data,
        ]);
        setKeywordInput('');
      }
    } catch (e) {
      alert('שגיאה בחיבור לשרת');
    } finally {
      setAddingKeyword(false);
    }
  };

  // Remove Blocked Keyword
  const handleRemoveKeyword = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blacklist?id=${id}&type=keyword`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) {
        alert(`שגיאה בהסרת החסימה: ${data.error}`);
      } else {
        setBlockedKeywordsList(blockedKeywordsList.filter((kw) => kw.id !== id));
      }
    } catch (e) {
      alert('שגיאה בחיבור לשרת');
    }
  };

  // Add Blocked Video
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !videoIdInput.trim() || !videoTitleInput.trim()) return;

    const videoId = extractVideoId(videoIdInput);
    if (videoId.length !== 11) {
      alert('מזהה הוידאו אינו תקין (חייב להכיל 11 תווים או להיות קישור יוטיוב תקין)');
      return;
    }

    if (blockedVideosList.some((v) => v.videoId === videoId)) {
      alert('שיר זה כבר חסום למשתמש זה.');
      return;
    }

    setAddingVideo(true);
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          type: 'video',
          videoId,
          videoTitle: videoTitleInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`שגיאה בחסימת השיר: ${data.error}`);
      } else {
        setBlockedVideosList([
          ...blockedVideosList,
          data,
        ]);
        setVideoIdInput('');
        setVideoTitleInput('');
      }
    } catch (e) {
      alert('שגיאה בחיבור לשרת');
    } finally {
      setAddingVideo(false);
    }
  };

  // Remove Blocked Video
  const handleRemoveVideo = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blacklist?id=${id}&type=video`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) {
        alert(`שגיאה בהסרת החסימה: ${data.error}`);
      } else {
        setBlockedVideosList(blockedVideosList.filter((v) => v.id !== id));
      }
    } catch (e) {
      alert('שגיאה בחיבור לשרת');
    }
  };

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M רשומים`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K רשומים`;
    return `${count} רשומים`;
  };

  if (!isPasswordVerified) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4 py-8">
        <div className="w-full max-w-md bg-card/40 border border-border/80 rounded-2xl p-8 shadow-xl backdrop-blur-md space-y-6">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">אימות מנהל מערכת</h2>
            <p className="text-muted-foreground text-sm">
              אנא הזן את סיסמת מנהל המערכת שלך כדי לגשת למסך הניהול.
            </p>
          </div>

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            {passwordError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl p-3 font-medium text-center">
                {passwordError}
              </div>
            )}
            <div>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-foreground text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground/30 placeholder:text-sm"
                placeholder="הזן סיסמת מנהל"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={verifyingPassword}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-semibold transition-all shadow-md disabled:opacity-50"
            >
              {verifyingPassword ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  בודק סיסמה...
                </>
              ) : (
                'כניסה למסך הניהול'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Column 1 & 2: Users Management */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* User Accounts List */}
        <div className="bg-card/40 border border-border/80 rounded-2xl p-6 shadow-md backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">חשבונות משתמשים</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-secondary text-muted-foreground rounded-full">
              {users.length} משתמשים רשומים
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wider pb-3">
                  <th className="pb-3 pt-1 text-right">שם המשתמש</th>
                  <th className="pb-3 pt-1 text-right">אימייל</th>
                  <th className="pb-3 pt-1 text-center">הצגת וידאו</th>
                  <th className="pb-3 pt-1 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {users.map((user) => (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-secondary/20 transition-colors ${
                      selectedUser?.id === user.id ? 'bg-primary/5 border-r-2 border-primary' : ''
                    }`}
                  >
                    <td className="py-4 font-semibold text-foreground">{user.name}</td>
                    <td className="py-4 text-muted-foreground">{user.email}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleToggleVideo(user.id, user.showVideo)}
                          className={`p-1.5 rounded-lg transition-all ${
                            user.showVideo 
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                              : 'bg-muted text-muted-foreground hover:bg-secondary'
                          }`}
                          title={user.showVideo ? 'וידאו פתוח' : 'אודיו בלבד (וידאו חסום)'}
                        >
                          {user.showVideo ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-left">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
                          selectedUser?.id === user.id 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'bg-secondary text-foreground hover:bg-secondary/80'
                        }`}
                      >
                        נהל ערוצים מורשים
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User Form */}
        <div className="bg-card/40 border border-border/80 rounded-2xl p-6 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2.5 mb-6">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">יצירת חשבון משתמש חדש</h2>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4 max-w-xl">
            {createError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl p-3 font-medium">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl p-3 font-medium">
                המשתמש נוצר בהצלחה במערכת!
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">שם פרטי / משפחתי</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">אימייל</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">סיסמה זמנית</label>
              <input
                type="password"
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="מינימום 6 תווים"
              />
            </div>

            <button
              type="submit"
              disabled={creatingUser}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-semibold transition-all shadow-md disabled:opacity-50"
            >
              {creatingUser ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  יוצר משתמש...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  צור חשבון משתמש
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Column 3: Allowed Channels Management (Whitelist) */}
      <div className="space-y-6">
        {selectedUser ? (
          <div className="bg-card/40 border border-border/80 rounded-2xl p-6 shadow-md backdrop-blur-md animate-fade-in">
            <div className="border-b border-border pb-4 mb-4">
              <h3 className="text-lg font-bold text-foreground">ניהול סינון משתמש</h3>
              <p className="text-xs text-muted-foreground mt-0.5">הגדרות סינון מותאמות עבור: <strong className="text-primary font-semibold">{selectedUser.name}</strong></p>
            </div>

            {/* Tabs for Whitelist / Blacklist */}
            <div className="flex border-b border-border mb-6">
              <button
                onClick={() => setActiveTab('whitelist')}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'whitelist' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                ערוצים מאושרים (Whitelist)
              </button>
              <button
                onClick={() => setActiveTab('blacklist')}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'blacklist' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                רשימה שחורה (Blacklist)
              </button>
            </div>

            {activeTab === 'whitelist' ? (
              <div className="space-y-6">
                {/* YouTube Search Autocomplete Input */}
                <div className="space-y-2 mb-6 relative">
                  <label className="block text-xs font-semibold text-muted-foreground">הוספת ערוץ / זמר חדש</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-10 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="חפש זמר או ערוץ ביוטיוב..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground pointer-events-none">
                      {searchingChannels ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Search className="h-4.5 w-4.5" />
                      )}
                    </div>
                    {searchQuery && (
                      <button 
                        type="button"
                        onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        title="נקה חיפוש"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl max-h-72 overflow-y-auto z-50 divide-y divide-border/60">
                      {searchResults.map((channel) => {
                        const isAdded = whitelist.some((w) => w.channelId === channel.channelId);
                        return (
                          <div 
                            key={channel.channelId}
                            onClick={() => !isAdded && handleAddChannel(channel)}
                            className={`flex items-center gap-3 p-3 transition-colors ${
                              isAdded 
                                ? 'bg-emerald-500/5 cursor-default' 
                                : 'hover:bg-secondary/40 cursor-pointer'
                            }`}
                          >
                            <img 
                              src={channel.thumbnail} 
                              alt={channel.title}
                              className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{channel.title}</p>
                              <p className="text-xs text-muted-foreground">{formatSubscribers(channel.subscribers)}</p>
                            </div>
                            {isAdded ? (
                              <Check className="h-5 w-5 text-emerald-400 ml-1" />
                            ) : (
                              <Plus className="h-4 w-4 text-primary ml-1" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* List of Allowed Channels */}
                <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">ערוצים מאושרים בפרופיל ({whitelist.length})</h4>
                
                {loadingWhitelist ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>טוען רשימת ערוצים...</span>
                  </div>
                ) : whitelist.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm bg-secondary/10 border border-dashed border-border rounded-xl">
                    אין ערוצים מאושרים למשתמש זה.<br />הוא לא יוכל לחפש או לשמוע שירים.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {whitelist.map((channel) => (
                      <div 
                        key={channel.channelId}
                        className="flex items-center justify-between p-2.5 bg-secondary/30 hover:bg-secondary/50 rounded-xl border border-border/40 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {channel.channelThumbnail ? (
                            <img 
                              src={channel.channelThumbnail} 
                              alt={channel.channelTitle} 
                              className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                              <Plus className="h-4.5 w-4.5" />
                            </div>
                          )}
                          <span className="text-sm font-semibold text-foreground truncate">{channel.channelTitle}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveChannel(channel.channelId)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="הסר ערוץ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Keyword Block Form */}
                <div className="space-y-2 bg-secondary/20 p-4 rounded-xl border border-border/40">
                  <h4 className="text-sm font-semibold text-foreground">חסימת מילות מפתח בכותרת</h4>
                  <p className="text-xs text-muted-foreground">סרטונים המכילים מילים אלו בכותרת לא יוצגו למשתמש (למשל: דואט, הופעה, לייב).</p>
                  <form onSubmit={handleAddKeyword} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      required
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      placeholder="למשל: דואט"
                      className="flex-1 px-3 py-1.5 bg-secondary/50 border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      disabled={addingKeyword}
                      className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      {addingKeyword ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      חסום מילה
                    </button>
                  </form>

                  {/* List of blocked keywords */}
                  <div className="mt-3">
                    {loadingBlacklist ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span>טוען רשימה...</span>
                      </div>
                    ) : blockedKeywordsList.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 italic">אין מילות מפתח חסומות</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {blockedKeywordsList.map((kw) => (
                          <span 
                            key={kw.id} 
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-destructive/10 border border-destructive/20 text-destructive rounded-full"
                          >
                            {kw.keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(kw.id)}
                              className="text-destructive/70 hover:text-destructive transition-colors focus:outline-none"
                              title="הסר חסימה"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Video Block Form */}
                <div className="space-y-2 bg-secondary/20 p-4 rounded-xl border border-border/40">
                  <h4 className="text-sm font-semibold text-foreground">חסימת שיר ספציפי (Video ID)</h4>
                  <p className="text-xs text-muted-foreground">חסום שיר ספציפי על ידי הזנת מזהה הוידאו או הקישור מיוטיוב.</p>
                  
                  <form onSubmit={handleAddVideo} className="space-y-2 mt-2">
                    <input
                      type="text"
                      required
                      value={videoIdInput}
                      onChange={(e) => setVideoIdInput(e.target.value)}
                      placeholder="מזהה וידאו (למשל: dQw4w9WgXcQ) או קישור יוטיוב"
                      className="w-full px-3 py-1.5 bg-secondary/50 border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={videoTitleInput}
                        onChange={(e) => setVideoTitleInput(e.target.value)}
                        placeholder="שם השיר / הערה (למשל: השיר החדש שלו)"
                        className="flex-1 px-3 py-1.5 bg-secondary/50 border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="submit"
                        disabled={addingVideo}
                        className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-semibold flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
                      >
                        {addingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        חסום שיר
                      </button>
                    </div>
                  </form>

                  {/* List of blocked videos */}
                  <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {loadingBlacklist ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span>טוען רשימה...</span>
                      </div>
                    ) : blockedVideosList.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 italic">אין שירים חסומים</p>
                    ) : (
                      blockedVideosList.map((vid) => (
                        <div 
                          key={vid.id}
                          className="flex items-center justify-between p-2 bg-destructive/5 border border-destructive/10 rounded-lg text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{vid.title}</p>
                            <p className="text-muted-foreground text-[10px]">ID: {vid.videoId}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVideo(vid.id)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="הסר חסימה"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center text-center py-20 px-6 border-2 border-dashed border-border/85 rounded-2xl text-muted-foreground bg-card/20 h-[480px]">
            <ListFilter className="h-10 w-10 text-primary/40 mb-3 animate-pulse" />
            <h3 className="font-bold text-foreground text-base">ניהול ערוצים</h3>
            <p className="text-xs mt-1 max-w-[200px]">בחר משתמש מרשימת החשבונות כדי לראות ולנהל את ערוצי ה-Whitelist שלו</p>
          </div>
        )}
      </div>
    </div>
  );
}
