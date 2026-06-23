'use client';

import { useState, useEffect } from 'react';
import { usePlayerStore, Track } from '@/store/usePlayerStore';
import { 
  FolderHeart, FolderPlus, Play, Trash2, ArrowRight, Music, 
  Loader2, Disc, PlayCircle, Plus
} from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  createdAt: string;
}

export default function LibraryClient({ initialPlaylists }: { initialPlaylists: Playlist[] }) {
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // New Playlist form state
  const [playlistName, setPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const playTrack = usePlayerStore((state) => state.playTrack);
  const currentTrack = usePlayerStore((state) => state.currentTrack);

  // Fetch items of selected playlist
  useEffect(() => {
    if (!selectedPlaylist) {
      setPlaylistTracks([]);
      return;
    }

    const fetchTracks = async () => {
      setLoadingTracks(true);
      try {
        const res = await fetch(`/api/playlists/items?playlistId=${selectedPlaylist.id}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setPlaylistTracks(data);
        }
      } catch (e) {
        console.error('Error fetching playlist items:', e);
      } finally {
        setLoadingTracks(false);
      }
    };

    fetchTracks();
  }, [selectedPlaylist]);

  // Create Playlist
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    setCreatingPlaylist(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistName }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setPlaylists([data, ...playlists]);
        setPlaylistName('');
      }
    } catch (e) {
      alert('שגיאה ביצירת רשימת השמעה');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Delete Playlist
  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('האם אתה בטוח שברצונך למחוק את פלייליסט זה? כל השירים בתוכו יוסרו.')) return;

    try {
      const res = await fetch('/api/playlists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: playlistId }),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists(playlists.filter((p) => p.id !== playlistId));
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(null);
        }
      }
    } catch (e) {
      alert('שגיאה במחיקת פלייליסט');
    }
  };

  // Remove Song from Playlist
  const handleRemoveTrack = async (videoId: string) => {
    if (!selectedPlaylist) return;

    try {
      const res = await fetch('/api/playlists/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId: selectedPlaylist.id,
          videoId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylistTracks(playlistTracks.filter((t) => t.videoId !== videoId));
      }
    } catch (e) {
      alert('שגיאה בהסרת השיר');
    }
  };

  return (
    <div dir="rtl" className="space-y-8 pb-10">
      {/* Header */}
      {!selectedPlaylist ? (
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">הספרייה שלי</h1>
          <p className="text-muted-foreground text-sm mt-1">רשימות ההשמעה האישיות שלך לקטלוג וניגון מהיר</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedPlaylist(null)}
            className="p-2 bg-secondary/50 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all"
            title="חזור לספרייה"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selectedPlaylist.name}</h1>
            <p className="text-muted-foreground text-xs mt-0.5">רשימת השמעה מותאמת אישית</p>
          </div>
        </div>
      )}

      {/* Main Panel Content */}
      {!selectedPlaylist ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* List of playlists (Col 1 & 2) */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FolderHeart className="h-5.5 w-5.5 text-primary" />
              רשימות ההשמעה שלי
            </h2>

            {playlists.length === 0 ? (
              <div className="text-center py-20 bg-card/25 border-2 border-dashed border-border/80 rounded-2xl text-muted-foreground">
                <Music className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                <h3 className="font-bold text-foreground text-base">אין פלייליסטים בספרייה</h3>
                <p className="text-xs text-muted-foreground mt-1">צור פלייליסט חדש בצד שמאל כדי להתחיל לשמור שירים מתוך החיפוש</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className="p-5 bg-card/45 border border-border/85 rounded-2xl hover:bg-secondary/20 transition-all shadow-sm cursor-pointer group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors text-base truncate">{playlist.name}</h3>
                        <span className="text-[10px] text-muted-foreground">נוצר לאחרונה</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="מחק פלייליסט"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new playlist box (Col 3) */}
          <div className="bg-card/45 border border-border/85 rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <FolderPlus className="h-5 w-5 text-primary" />
              יצירת פלייליסט חדש
            </h2>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">שם רשימת השמעה</label>
                <input
                  type="text"
                  required
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="למשל: שירי שבת, ניגוני חב״ד..."
                />
              </div>

              <button
                type="submit"
                disabled={creatingPlaylist || !playlistName.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-semibold transition-all shadow-md disabled:opacity-50"
              >
                {creatingPlaylist ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    יוצר...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    צור פלייליסט
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Playlist Detailed View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/25 border border-border rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Disc className="h-8 w-8 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedPlaylist.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{playlistTracks.length} שירים ברשימה</p>
              </div>
            </div>

            {playlistTracks.length > 0 && (
              <button
                onClick={() => playTrack(playlistTracks[0], playlistTracks)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl text-sm transition-all shadow-lg hover:scale-102"
              >
                <Play className="h-4.5 w-4.5 fill-current" />
                נגן את כל הרשימה
              </button>
            )}
          </div>

          {loadingTracks ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>טוען שירים מהפלייליסט...</span>
            </div>
          ) : playlistTracks.length === 0 ? (
            <div className="text-center py-20 bg-card/20 rounded-2xl text-muted-foreground">
              <Music className="h-10 w-10 text-primary/30 mx-auto mb-3" />
              <h3 className="font-bold text-foreground text-base">אין שירים בפלייליסט זה</h3>
              <p className="text-xs text-muted-foreground mt-1">חיפוש שירים והקש על כפתור ה- (+) כדי לשמור אותם לכאן</p>
            </div>
          ) : (
            <div className="bg-card/30 border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="divide-y divide-border/60">
                {playlistTracks.map((track, idx) => {
                  const isPlayingThis = currentTrack?.videoId === track.videoId;
                  return (
                    <div
                      key={track.videoId}
                      className={`flex items-center justify-between p-3.5 hover:bg-secondary/25 transition-all group ${
                        isPlayingThis ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div 
                        onClick={() => playTrack(track, playlistTracks)}
                        className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-muted-foreground w-6 text-center group-hover:hidden">
                          {idx + 1}
                        </span>
                        <div className="p-1 bg-primary/10 rounded-full text-primary hidden group-hover:block w-6 text-center">
                          <Play className="h-3 w-3 fill-current mx-auto" />
                        </div>
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="truncate pr-1">
                          <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-primary' : 'text-foreground'}`}>
                            {track.title}
                          </h4>
                          <span className="text-xs text-muted-foreground">ערוץ מאושר</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveTrack(track.videoId)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                        title="הסר שיר"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
