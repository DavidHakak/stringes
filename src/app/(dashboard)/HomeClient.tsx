'use client';

import { usePlayerStore, Track } from '@/store/usePlayerStore';
import { Play, Music, Sparkles, History, ChevronLeft, Plus, X, Loader2, FolderHeart, Check } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SearchPage from './search/page'; // Just for referencing types if needed

interface HomeClientProps {
  recentTracks: Track[];
  recommendedTracks: Track[];
  userName: string;
}

export default function HomeClient({ recentTracks, recommendedTracks, userName }: HomeClientProps) {
  const playTrack = usePlayerStore((state) => state.playTrack);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const router = useRouter();

  // Playlists add workflow states (integrated similar to search)
  const [activeTrackForPlaylist, setActiveTrackForPlaylist] = useState<Track | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [addedStatus, setAddedStatus] = useState<Record<string, boolean>>({});

  const handleOpenPlaylistSelector = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTrackForPlaylist(track);
    setLoadingPlaylists(true);
    setNewPlaylistName('');
    
    try {
      const res = await fetch('/api/playlists');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlaylists(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!activeTrackForPlaylist) return;
    const track = activeTrackForPlaylist;

    try {
      const res = await fetch('/api/playlists/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId,
          videoId: track.videoId,
          title: track.title,
          thumbnail: track.thumbnail,
        }),
      });

      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else {
        setAddedStatus((prev) => ({ ...prev, [playlistId]: true }));
        setTimeout(() => {
          setAddedStatus((prev) => ({ ...prev, [playlistId]: false }));
          setActiveTrackForPlaylist(null);
        }, 1500);
      }
    } catch (e) {
      alert('שגיאה בחיבור לשרת');
    }
  };

  const handleCreateAndAddPlaylist = async () => {
    if (!newPlaylistName.trim() || !activeTrackForPlaylist) return;
    setCreatingPlaylist(true);

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName }),
      });
      const newPlaylist = await res.json();

      if (newPlaylist.error) {
        alert(newPlaylist.error);
      } else {
        setPlaylists([newPlaylist, ...playlists]);
        setNewPlaylistName('');
        await handleAddToPlaylist(newPlaylist.id);
      }
    } catch (e) {
      alert('שגיאה ביצירת פלייליסט');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-10 pb-10">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/30 to-violet-600/10 border border-primary/20 rounded-3xl p-6 sm:p-8 shadow-lg">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">שלום, {userName}!</h1>
          <p className="text-muted-foreground text-sm max-w-md sm:text-base leading-relaxed">
            ברוך הבא לנגן המוזיקה המשפחתי שלך. האזנה נעימה, נקייה ומותאמת אישית מובטחת לך כעת.
          </p>
        </div>
      </div>

      {/* Section: Recently Played */}
      {recentTracks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">הושמעו לאחרונה</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentTracks.map((track) => {
              const isPlayingThis = currentTrack?.videoId === track.videoId;
              return (
                <div
                  key={track.videoId}
                  onClick={() => {
                    usePlayerStore.getState().setRepeat('all');
                    playTrack(track, recommendedTracks);
                  }}
                  className={`flex items-center gap-3 p-3 bg-card/40 border border-border/80 rounded-xl hover:bg-secondary/40 transition-all cursor-pointer group relative ${
                    isPlayingThis ? 'bg-primary/5 border-primary/40' : ''
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-border/50">
                    <img 
                      src={track.thumbnail} 
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-4 w-4 text-white fill-current" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {track.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{track.channelTitle || 'ערוץ מאושר'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section: Recommendations from Whitelist */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground font-sans">המלצות מהערוצים המאושרים שלך</h2>
        </div>

        {recommendedTracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recommendedTracks.map((track) => {
              const isPlayingThis = currentTrack?.videoId === track.videoId;
              return (
                <div 
                  key={track.videoId}
                  onClick={() => {
                    usePlayerStore.getState().setRepeat('all');
                    playTrack(track, recommendedTracks);
                  }}
                  className="bg-card/30 border border-border/80 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative aspect-video bg-black/20 overflow-hidden border-b border-border/40">
                    <img 
                      src={track.thumbnail} 
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <div 
                        className="p-3 bg-primary text-white rounded-full shadow-lg"
                        title="נגן כעת"
                      >
                        <Play className="h-5 w-5 fill-current" />
                      </div>
                      <button 
                        onClick={(e) => handleOpenPlaylistSelector(track, e)}
                        className="p-3 bg-secondary/80 text-foreground hover:bg-secondary rounded-full shadow-lg"
                        title="שמור לפלייליסט"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md animate-pulse">
                          מנגן כעת
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground text-sm line-clamp-2 leading-relaxed" title={track.title}>
                        {track.title}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{track.channelTitle}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card/10 border border-dashed border-border rounded-2xl max-w-xl">
            <Music className="h-10 w-10 text-primary/30 mx-auto mb-3" />
            <h3 className="font-bold text-foreground text-base">אין ערוצים מאושרים לפרופיל זה</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto px-6">
              מנהל המערכת (אב/אם המשפחה) צריך להוסיף זמרים וערוצי יוטיוב מאושרים לחשבון שלך בפאנל הניהול כדי שתוכל לראות פה המלצות ולהאזין למוזיקה.
            </p>
          </div>
        )}
      </div>

      {/* Playlist Selector Modal (similar to search) */}
      {activeTrackForPlaylist && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 relative">
            <button 
              onClick={() => setActiveTrackForPlaylist(null)}
              className="absolute top-4 left-4 p-1 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1 pr-1.5">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FolderHeart className="h-5 w-5 text-primary" />
                שמור לרשימת השמעה
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">שיר: {activeTrackForPlaylist.title}</p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {loadingPlaylists ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                  <span>טוען פלייליסטים...</span>
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground bg-secondary/15 rounded-xl border border-dashed border-border">
                  עדיין לא יצרת פלייליסטים.
                </div>
              ) : (
                playlists.map((playlist) => {
                  const isAdded = addedStatus[playlist.id];
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => handleAddToPlaylist(playlist.id)}
                      className="w-full flex items-center justify-between p-2.5 bg-secondary/30 hover:bg-secondary/60 text-right rounded-xl text-sm font-medium transition-colors border border-border/40"
                    >
                      <span>{playlist.name}</span>
                      {isAdded ? (
                        <span className="text-emerald-400 text-xs flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          נשמר!
                        </span>
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-border/50 pt-4 space-y-2.5">
              <label className="block text-xs font-semibold text-muted-foreground">צור פלייליסט חדש ושמור</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-secondary/50 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="שם הפלייליסט..."
                />
                <button
                  onClick={handleCreateAndAddPlaylist}
                  disabled={creatingPlaylist || !newPlaylistName.trim()}
                  className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/95 transition-all disabled:opacity-50"
                >
                  {creatingPlaylist ? 'יוצר...' : 'צור ושמור'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
