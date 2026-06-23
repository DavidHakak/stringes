'use client';

import { usePlayerStore, Track } from '@/store/usePlayerStore';
import { Play, Music, Users, Plus, X, Loader2, FolderHeart, Check } from 'lucide-react';
import { useState } from 'react';

interface Artist {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  tracks: Track[];
}

interface ArtistsClientProps {
  artists: Artist[];
}

export default function ArtistsClient({ artists }: ArtistsClientProps) {
  const playTrack = usePlayerStore((state) => state.playTrack);
  const currentTrack = usePlayerStore((state) => state.currentTrack);

  // Playlists add workflow states
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

  const handlePlayArtist = (tracks: Track[]) => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  return (
    <div dir="rtl" className="space-y-10 pb-10">
      {/* Title Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/30 to-violet-600/10 border border-primary/20 rounded-3xl p-6 sm:p-8 shadow-lg">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            אמנים מאושרים
          </h1>
          <p className="text-muted-foreground text-sm max-w-md sm:text-base leading-relaxed">
            כל הערוצים והיוצרים המאושרים להשמעה בפרופיל שלך. לחץ על שיר לנגינה או לחץ על "נגן הכל" להשמעת כל שירי האמן ברצף.
          </p>
        </div>
      </div>

      {artists.length > 0 ? (
        <div className="space-y-12">
          {artists.map((artist) => (
            <div key={artist.channelId} className="space-y-4">
              {/* Artist Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-muted flex-shrink-0">
                    {artist.channelThumbnail ? (
                      <img 
                        src={artist.channelThumbnail} 
                        alt={artist.channelTitle} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary text-muted-foreground text-xs">
                        {artist.channelTitle[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{artist.channelTitle}</h2>
                    <p className="text-xs text-muted-foreground">{artist.tracks.length} שירים מאושרים</p>
                  </div>
                </div>

                {artist.tracks.length > 0 && (
                  <button
                    onClick={() => handlePlayArtist(artist.tracks)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs sm:text-sm font-semibold rounded-full transition-all duration-300 shadow-sm"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>נגן הכל</span>
                  </button>
                )}
              </div>

              {/* Tracks Horizontal Scroll */}
              {artist.tracks.length > 0 ? (
                <div className="flex gap-6 overflow-x-auto pb-4 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
                  {artist.tracks.map((track) => {
                    const isPlayingThis = currentTrack?.videoId === track.videoId;
                    return (
                      <div 
                        key={track.videoId}
                        onClick={() => playTrack(track, artist.tracks)}
                        className="w-64 bg-card/30 border border-border/80 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col justify-between cursor-pointer flex-shrink-0"
                      >
                        <div className="relative aspect-video bg-black/20 overflow-hidden border-b border-border/40">
                          <img 
                            src={track.thumbnail} 
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <div 
                              className="p-2.5 bg-primary text-white rounded-full shadow-lg"
                              title="נגן כעת"
                            >
                              <Play className="h-4.5 w-4.5 fill-current" />
                            </div>
                            <button 
                              onClick={(e) => handleOpenPlaylistSelector(track, e)}
                              className="p-2.5 bg-secondary/80 text-foreground hover:bg-secondary rounded-full shadow-lg"
                              title="שמור לפלייליסט"
                            >
                              <Plus className="h-4.5 w-4.5" />
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
                          <h3 className="font-semibold text-foreground text-xs sm:text-sm line-clamp-2 leading-relaxed" title={track.title}>
                            {track.title}
                          </h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground bg-secondary/10 rounded-xl border border-dashed border-border/60">
                  לא נמצאו שירים זמינים עבור אמן זה.
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card/10 border border-dashed border-border rounded-3xl max-w-xl mx-auto">
          <Music className="h-12 w-12 text-primary/30 mx-auto mb-4" />
          <h3 className="font-bold text-foreground text-lg">אין אמנים מאושרים</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto px-6">
            עדיין לא הוגדרו ערוצים מאושרים לפרופיל שלך. בקש ממנהל המערכת (אבא או אמא) להוסיף זמרים וערוצים מאושרים דרך מסך הניהול.
          </p>
        </div>
      )}

      {/* Playlist Selector Modal */}
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
