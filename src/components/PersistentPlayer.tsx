'use client';

import { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import { usePlayerStore } from '@/store/usePlayerStore';
import { createClient } from '@/utils/supabase/client';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, ChevronUp, ChevronDown, Music,
  Loader2, Maximize2, Minimize2
} from 'lucide-react';

export default function PersistentPlayer() {
  const supabase = createClient();

  // Zustand State
  const {
    currentTrack,
    isPlaying,
    queue,
    currentIndex,
    volume,
    progress,
    duration,
    showVideo,
    muted,
    repeat,
    shuffle,
    setPlaying,
    nextTrack,
    prevTrack,
    setVolume,
    setProgress,
    setDuration,
    togglePlay,
    toggleMuted,
    setRepeat,
    toggleShuffle
  } = usePlayerStore();

  const [playerReady, setPlayerReady] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState(false);
  const [isVideoFullScreen, setIsVideoFullScreen] = useState(false);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const forcePlayCount = useRef<number>(0);

  // Playback session limit counter (2 hours)
  const playbackTimer = useRef<number>(0);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  // Reset counter when song changes (select a new song)
  useEffect(() => {
    playbackTimer.current = 0;
    setShowTimeoutModal(false);
    forcePlayCount.current = 0; // Reset force play attempts count
  }, [currentTrack?.videoId]);

  // Refs for video positioning slots
  const minimizedPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const mobileExpandedPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const desktopExpandedPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const [videoStyle, setVideoStyle] = useState<React.CSSProperties>({});

  // Dynamic video slot position calculator
  useEffect(() => {
    if (!showVideo) return;

    const updatePosition = () => {
      if (isVideoFullScreen) {
        setVideoStyle({
          position: 'fixed',
          left: '0px',
          top: '0px',
          width: '100vw',
          height: '100vh',
          borderRadius: '0px',
          zIndex: 60,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        });
        return;
      }

      let activePlaceholder: HTMLDivElement | null = null;

      if (expandedMobile) {
        if (window.innerWidth >= 768) {
          activePlaceholder = desktopExpandedPlaceholderRef.current;
        } else {
          activePlaceholder = mobileExpandedPlaceholderRef.current;
        }
      } else {
        activePlaceholder = minimizedPlaceholderRef.current;
      }

      if (activePlaceholder) {
        const rect = activePlaceholder.getBoundingClientRect();
        setVideoStyle({
          position: 'fixed',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderRadius: window.getComputedStyle(activePlaceholder).borderRadius || '12px',
          zIndex: expandedMobile ? 51 : 31,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        });
      }
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    // Interval ensures sync during React layout transitions
    const interval = setInterval(updatePosition, 50);
    const timer = setTimeout(updatePosition, 300);

    return () => {
      window.removeEventListener('resize', updatePosition);
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [showVideo, expandedMobile, isVideoFullScreen, currentTrack?.videoId]);

  // Listen for escape key to exit video full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVideoFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync play/pause state from Zustand to YouTube player
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;

    try {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.error('Error controlling player: ', e);
    }
  }, [isPlaying, playerReady, currentTrack?.videoId]);

  // Track play history inside Supabase when a song starts playing
  useEffect(() => {
    if (!currentTrack) return;

    const saveToHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Add to play_history table using client API
      await supabase.from('play_history').insert({
        user_id: user.id,
        video_id: currentTrack.videoId,
        title: currentTrack.title,
        thumbnail: currentTrack.thumbnail,
      });
    };

    saveToHistory();
  }, [currentTrack?.videoId]);

  // Media Session API for lock screen and background control
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.channelTitle || 'מיתרים',
        album: 'מיתרים',
        artwork: [
          { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      // Update play/pause state in browser media session
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.error('Media Session metadata error:', e);
    }
  }, [currentTrack?.videoId, isPlaying]);

  // Hook action handlers for Media Session
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        setPlaying(true);
        if (playerRef.current) playerRef.current.playVideo();
        if (silentAudioRef.current) {
          silentAudioRef.current.play().catch(() => {});
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setPlaying(false);
        if (playerRef.current) playerRef.current.pauseVideo();
        if (silentAudioRef.current) {
          silentAudioRef.current.pause();
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && playerRef.current) {
          playerRef.current.seekTo(details.seekTime, true);
          setProgress(details.seekTime);
        }
      });
    } catch (e) {
      console.error('Media Session action handlers error:', e);
    }

    return () => {
      if (!('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch (e) {}
    };
  }, [playerReady, prevTrack, nextTrack, setPlaying, setProgress, silentAudioRef]);

  // Initialize silent HTML5 Audio element once on mount and unlock it on user gesture
  useEffect(() => {
    const silenceSrc = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
    const audio = new Audio(silenceSrc);
    audio.loop = true;
    audio.volume = 0.01;
    silentAudioRef.current = audio;

    const unlockAudio = () => {
      if (audio) {
        audio.play()
          .then(() => {
            // Unlocked successfully. Pause if the user is not actively playing.
            if (!usePlayerStore.getState().isPlaying) {
              audio.pause();
            }
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchend', unlockAudio);
          })
          .catch((err) => console.warn('Silent audio context unlock failed:', err));
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchend', unlockAudio);

    return () => {
      audio.pause();
      silentAudioRef.current = null;
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchend', unlockAudio);
    };
  }, []);

  // Prevent YouTube player from pausing when tab goes background on desktop
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      // If the tab is hidden but the state says we should be playing
      if (document.hidden && isPlaying && playerRef.current && playerReady) {
        // Wait a brief moment for browser's default pause event to finish, then force play
        timer = setTimeout(() => {
          try {
            if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
              playerRef.current.playVideo();
            }
          } catch (e) {
            console.error('Failed to force resume background playback:', e);
          }
        }, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timer) clearTimeout(timer);
    };
  }, [isPlaying, playerReady]);

  // Sync silent audio playback with the global playing state
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        // Safe to warn since it will be unlocked on gesture
        console.warn('Silent audio play waiting gesture unlock:', err);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync volume state from Zustand to YouTube player
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;

    try {
      if (muted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch (e) {
      console.error(e);
    }
  }, [volume, muted, playerReady, currentTrack?.videoId]);

  // Update progress timer & cumulative playback counter
  useEffect(() => {
    if (isPlaying && playerReady && playerRef.current) {
      progressInterval.current = setInterval(() => {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          setProgress(currentTime);

          // Increment playback timer by 0.5 seconds
          playbackTimer.current += 0.5;

          // 2 hours = 7200 seconds
          if (playbackTimer.current >= 7200) {
            playerRef.current.pauseVideo();
            setPlaying(false);
            setShowTimeoutModal(true);
          }
        } catch (e) { }
      }, 500);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, playerReady, setProgress]);

  if (!currentTrack) return null;

  // YouTube Player Event Handlers
  const onReady = (event: any) => {
    playerRef.current = event.target;
    setPlayerReady(true);

    // Set initial configuration
    event.target.setVolume(muted ? 0 : volume);
    setDuration(event.target.getDuration());

    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onStateChange = (event: any) => {
    // states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    const state = event.data;
    if (state === 1) {
      setPlaying(true);
      setDuration(event.target.getDuration());
      forcePlayCount.current = 0; // Reset count on successful play
    } else if (state === 2) {
      // If paused, check if user requested playing and tab is hidden (browser-induced pause)
      if (document.hidden && usePlayerStore.getState().isPlaying) {
        if (forcePlayCount.current < 5) {
          forcePlayCount.current += 1;
          setTimeout(() => {
            try {
              if (event.target && typeof event.target.playVideo === 'function') {
                event.target.playVideo();
              }
            } catch (e) {
              console.error('Failed to force play in background:', e);
            }
          }, 100);
        } else {
          console.warn('Failed to force play after 5 attempts, stopping background playback.');
          setPlaying(false);
        }
      } else {
        setPlaying(false);
      }
    } else if (state === 0) {
      // Song ended
      if (repeat === 'one') {
        event.target.seekTo(0, true);
        event.target.playVideo();
      } else {
        nextTrack();
      }
    } else if (state === 5 || state === -1) {
      // Cued or unstarted: if we are supposed to be playing and tab is hidden (background transition), force play!
      if (document.hidden && usePlayerStore.getState().isPlaying) {
        if (forcePlayCount.current < 5) {
          forcePlayCount.current += 1;
          setTimeout(() => {
            try {
              if (event.target && typeof event.target.playVideo === 'function') {
                event.target.playVideo();
              }
            } catch (e) {
              console.error('Failed to force play in background:', e);
            }
          }, 100);
        } else {
          console.warn('Failed to force play after 5 attempts, stopping background playback.');
          setPlaying(false);
        }
      }
    }
  };

  const onEnd = () => {
    if (repeat !== 'one') {
      nextTrack();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setProgress(value);
    if (playerRef.current) {
      playerRef.current.seekTo(value, true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setVolume(value);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleRepeatToggle = () => {
    if (repeat === 'none') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('none');
  };

  const handleContinuePlayback = () => {
    playbackTimer.current = 0;
    setShowTimeoutModal(false);
    setPlaying(true);
    if (playerRef.current) {
      playerRef.current.playVideo();
    }
  };

  return (
    <>
      {/* Floating/Fullscreen/Embedded YouTube Video Window */}
      <div
        className={`fixed overflow-hidden bg-black transition-all ${showVideo
          ? 'border border-border shadow-2xl'
          : 'pointer-events-none'
          }`}
        style={showVideo ? videoStyle : {
          position: 'fixed',
          bottom: '0px',
          right: '0px',
          width: '300px',
          height: '200px',
          opacity: 0.001,
          zIndex: -50,
        }}
      >
        {/* Transparent Click Blocker Overlay */}
        <div
          onClick={() => {
            if (!expandedMobile) {
              setExpandedMobile(true);
            }
          }}
          className={`absolute inset-0 bg-transparent z-10 ${!expandedMobile ? 'cursor-pointer' : 'cursor-default'}`}
        />

        {/* Custom Video Controls Overlay (visible on hover) - only when player is expanded */}
        <div className={`absolute inset-0 bg-black/45 transition-opacity z-20 flex flex-col justify-between p-2 ${expandedMobile ? 'opacity-0 hover:opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
          <div className="flex items-center justify-between w-full">
            <span className="text-white text-xs font-medium truncate max-w-[180px] bg-black/50 px-2 py-0.5 rounded">
              {currentTrack.title}
            </span>
            <button
              onClick={() => setIsVideoFullScreen(!isVideoFullScreen)}
              className="p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-lg transition-colors"
              title={isVideoFullScreen ? "מזער" : "מסך מלא"}
            >
              {isVideoFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Overlay controls in fullscreen */}
          {isVideoFullScreen && (
            <div dir="rtl" className="flex flex-col gap-3 w-full max-w-2xl mx-auto px-6 bg-black/80 backdrop-blur-md py-4 rounded-2xl border border-white/10 shadow-2xl mb-4">
              {/* Scrubber (runs from left to right) */}
              <div dir="ltr" className="flex items-center gap-3 w-full text-xs text-white">
                <span className="w-10 text-right font-medium">{formatTime(progress)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer focus:outline-none accent-primary"
                />
                <span className="w-10 text-left font-medium">{formatTime(duration)}</span>
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between w-full">
                <span className="text-white/80 text-sm font-semibold truncate max-w-[200px] sm:max-w-xs">
                  {currentTrack.title}
                </span>

                <div className="flex items-center gap-6">
                  <button onClick={prevTrack} className="text-white hover:text-primary transition-colors p-1" title="שיר הקודם">
                    <SkipBack className="h-5 w-5 rotate-180" />
                  </button>
                  <button onClick={togglePlay} className="p-3 bg-primary text-primary-foreground rounded-full hover:scale-105 transition-transform shadow-md">
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                  </button>
                  <button onClick={nextTrack} className="text-white hover:text-primary transition-colors p-1" title="שיר הבא">
                    <SkipForward className="h-5 w-5 rotate-180" />
                  </button>
                </div>

                <button
                  onClick={() => setIsVideoFullScreen(false)}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/25 text-white rounded-xl transition-all text-xs font-semibold"
                >
                  יציאה ממסך מלא
                </button>
              </div>
            </div>
          )}
        </div>

        <YouTube
          videoId={currentTrack.videoId}
          opts={{
            height: '100%',
            width: '100%',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              iv_load_policy: 3,
            },
          }}
          onReady={onReady}
          onStateChange={onStateChange}
          onEnd={onEnd}
          className="w-full h-full pointer-events-none"
        />
      </div>

      {/* Persistent Player UI Bar */}
      <div
        dir="rtl"
        className={`fixed bg-card/85 backdrop-blur-xl w-full border-t border-border shadow-xl transition-all duration-300 ${expandedMobile
          ? 'inset-0 z-50 flex flex-col justify-between p-6'
          : 'bottom-[64px] left-0 right-0 md:bottom-0 md:left-64 h-20 flex items-center justify-between px-4 sm:px-6 z-30'
          }`}
      >
        {/* Expanded View */}
        {expandedMobile ? (
          <>
            {/* Mobile Expanded View */}
            <div className="flex flex-col h-full justify-between w-full max-w-lg mx-auto md:hidden">
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExpandedMobile(false)}
                  className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="h-6 w-6" />
                </button>
                <span className="text-sm font-semibold tracking-wide text-muted-foreground">מנגן כעת</span>
                <div className="w-10" /> {/* Spacer */}
              </div>

              {/* Album Art / Video Placeholder Container */}
              <div className="flex-1 flex flex-col items-center justify-center py-6">
                {showVideo ? (
                  <div
                    ref={mobileExpandedPlaceholderRef}
                    className="relative w-72 h-44 sm:w-80 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border border-border bg-black animate-fade-in"
                  />
                ) : (
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border border-border group animate-fade-in">
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                    {!playerReady && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center text-primary">
                        <Loader2 className="h-10 w-10 animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="space-y-1 text-center px-4">
                <h3 className="text-xl font-bold text-foreground line-clamp-1">{currentTrack.title}</h3>
                <p className="text-muted-foreground text-sm font-medium">{currentTrack.channelTitle || 'ערוץ מאושר'}</p>
              </div>

              {/* Controls & Progress */}
              <div className="space-y-6 mt-8">
                {/* Scrubber */}
                <div dir="ltr" className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={progress}
                    onChange={handleSeek}
                    className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Main Controls buttons */}
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={toggleShuffle}
                    className={`p-2 transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Shuffle className="h-5 w-5" />
                  </button>
                  <button
                    onClick={prevTrack}
                    className="p-3 bg-secondary/50 hover:bg-secondary text-foreground rounded-full transition-all"
                  >
                    <SkipBack className="h-6 w-6 rotate-180" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-5 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
                  </button>
                  <button
                    onClick={nextTrack}
                    className="p-3 bg-secondary/50 hover:bg-secondary text-foreground rounded-full transition-all"
                  >
                    <SkipForward className="h-6 w-6 rotate-180" />
                  </button>
                  <button
                    onClick={handleRepeatToggle}
                    className={`p-2 transition-colors ${repeat !== 'none' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                  </button>
                </div>

                {/* Volume bar */}
                <div className="flex items-center justify-center gap-3 px-8 pb-4">
                  <button onClick={toggleMuted} className="text-muted-foreground hover:text-foreground">
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Desktop Expanded View */}
            <div className="hidden md:flex flex-col h-full w-full max-w-5xl mx-auto justify-between py-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExpandedMobile(false)}
                  className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="h-6 w-6" />
                </button>
                <span className="text-sm font-semibold tracking-wide text-muted-foreground">מנגן כעת</span>
                <div className="w-10" /> {/* Spacer */}
              </div>

              {/* Main Split View Content */}
              <div className="flex-1 flex items-center justify-center gap-16 my-8">
                {/* Right Column: Album Art / Video Placeholder */}
                {showVideo ? (
                  <div
                    ref={desktopExpandedPlaceholderRef}
                    className="relative w-96 h-56 lg:w-[450px] lg:h-[260px] rounded-3xl overflow-hidden shadow-2xl border border-border bg-black flex-shrink-0"
                  />
                ) : (
                  <div className="relative w-80 h-80 lg:w-96 lg:h-96 rounded-3xl overflow-hidden shadow-2xl border border-border group animate-fade-in flex-shrink-0">
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                    {!playerReady && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center text-primary">
                        <Loader2 className="h-12 w-12 animate-spin" />
                      </div>
                    )}
                  </div>
                )}

                {/* Left Column: Info, Scrubber, Controls */}
                <div className="flex-1 max-w-lg space-y-8">
                  {/* Track Titles */}
                  <div className="space-y-2">
                    <h3 className="text-2xl lg:text-3xl font-extrabold text-foreground line-clamp-2 leading-tight">
                      {currentTrack.title}
                    </h3>
                    <p className="text-primary text-base font-semibold">
                      {currentTrack.channelTitle || 'ערוץ מאושר'}
                    </p>
                  </div>

                  {/* Scrubber (runs from left to right) */}
                  <div dir="ltr" className="space-y-2.5">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={progress}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Playback Control Buttons */}
                  <div className="flex items-center justify-between px-6 bg-secondary/10 py-3 rounded-2xl border border-border/40">
                    <button
                      onClick={toggleShuffle}
                      className={`p-2 transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      title="ערבוב שירים"
                    >
                      <Shuffle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={prevTrack}
                      className="p-3 hover:bg-secondary/80 text-foreground rounded-full transition-all"
                      title="שיר הקודם"
                    >
                      <SkipBack className="h-6 w-6 rotate-180" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-105 transition-transform"
                    >
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
                    </button>
                    <button
                      onClick={nextTrack}
                      className="p-3 hover:bg-secondary/80 text-foreground rounded-full transition-all"
                      title="שיר הבא"
                    >
                      <SkipForward className="h-6 w-6 rotate-180" />
                    </button>
                    <button
                      onClick={handleRepeatToggle}
                      className={`p-2 transition-colors ${repeat !== 'none' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      title="לולאת השמעה"
                    >
                      {repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Volume bar */}
                  <div className="flex items-center gap-4 bg-secondary/20 p-3 rounded-xl border border-border/30">
                    <button onClick={toggleMuted} className="text-muted-foreground hover:text-foreground">
                      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Standard Bottom Bar View */
          <div className="flex items-center justify-between w-full">
            {/* Right: Album Art & Title */}
            <div
              onClick={() => setExpandedMobile(true)}
              className="flex items-center gap-3 flex-1 md:flex-initial min-w-0 cursor-pointer group"
            >
              {showVideo ? (
                <div
                  ref={minimizedPlaceholderRef}
                  className="w-16 h-10 sm:w-20 sm:h-12 rounded-lg overflow-hidden border border-border bg-black flex-shrink-0"
                />
              ) : (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="truncate pr-1">
                <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {currentTrack.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.channelTitle || 'ערוץ מאושר'}
                </p>
              </div>
              <ChevronUp className="h-4 w-4 text-muted-foreground md:hidden flex-shrink-0 mr-1 animate-bounce" />
            </div>

            {/* Middle: Controls & Progress Bar (Desktop only) */}
            <div className="hidden md:flex flex-col items-center flex-1 max-w-xl px-8 space-y-1.5">
              <div className="flex items-center gap-6">
                <button
                  onClick={toggleShuffle}
                  className={`transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  title="ערבוב שירים"
                >
                  <Shuffle className="h-4 w-4" />
                </button>
                <button
                  onClick={prevTrack}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="שיר הקודם"
                >
                  <SkipBack className="h-4.5 w-4.5 rotate-180" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2.5 bg-primary text-primary-foreground rounded-full hover:scale-105 transition-transform shadow-md"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                </button>
                <button
                  onClick={nextTrack}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="שיר הבא"
                >
                  <SkipForward className="h-4.5 w-4.5 rotate-180" />
                </button>
                <button
                  onClick={handleRepeatToggle}
                  className={`transition-colors ${repeat !== 'none' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  title="לולאת השמעה"
                >
                  {repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                </button>
              </div>

              {/* Progress Slider */}
              <div dir="ltr" className="flex items-center gap-2.5 w-full text-xs text-muted-foreground">
                <span className="w-8 text-right">{formatTime(progress)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none"
                />
                <span className="w-8 text-left">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Left: Volume (Desktop only) or Compact Play controls (Mobile only) */}
            <div className="flex items-center gap-3">
              {/* Mobile controls */}
              <div className="flex items-center gap-1 md:hidden">
                <button
                  onClick={togglePlay}
                  className="p-2 text-foreground hover:text-primary transition-colors"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                <button
                  onClick={nextTrack}
                  className="p-2 text-foreground hover:text-primary transition-colors"
                >
                  <SkipForward className="h-6 w-6 rotate-180" />
                </button>
              </div>

              {/* Desktop volume */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={toggleMuted}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2-Hour Timeout Continuation Modal */}
      {showTimeoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-scale-in">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
              <Music className="h-8 w-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">האם ברצונך להמשיך להאזין?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                עברו שעתיים של נגינה רציפה. כדי לשמור על חיבור תקין ולמנוע השמעה ללא מאזינים, אנא אשר שאתה עדיין פה.
              </p>
            </div>
            <button
              onClick={handleContinuePlayback}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:scale-102 transition-transform shadow-lg cursor-pointer font-sans"
            >
              כן, המשך להשמיע
            </button>
          </div>
        </div>
      )}
    </>
  );
}
