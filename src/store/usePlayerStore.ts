import { create } from 'zustand';

export interface Track {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
  channelId?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  currentIndex: number;
  volume: number;
  progress: number;
  duration: number;
  showVideo: boolean;
  muted: boolean;
  repeat: 'none' | 'one' | 'all';
  shuffle: boolean;
  originalQueue: Track[]; // Used for restoring queue when toggling shuffle off

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setQueue: (queue: Track[]) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setShowVideo: (showVideo: boolean) => void;
  toggleMuted: () => void;
  setRepeat: (repeat: 'none' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  currentIndex: -1,
  volume: 80,
  progress: 0,
  duration: 0,
  showVideo: false,
  muted: false,
  repeat: 'none',
  shuffle: false,
  originalQueue: [],

  playTrack: (track, newQueue) => {
    const { queue, shuffle } = get();
    let updatedQueue = newQueue || [...queue];
    
    // If the track is not in the queue, add it
    const trackIndex = updatedQueue.findIndex((t) => t.videoId === track.videoId);
    let finalIndex = trackIndex;
    
    if (trackIndex === -1) {
      updatedQueue = [...updatedQueue, track];
      finalIndex = updatedQueue.length - 1;
    }

    set({
      currentTrack: track,
      queue: updatedQueue,
      originalQueue: shuffle ? get().originalQueue : updatedQueue,
      currentIndex: finalIndex,
      isPlaying: true,
      progress: 0,
    });
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setPlaying: (isPlaying) => set({ isPlaying }),
  
  setQueue: (queue) => {
    set({ 
      queue, 
      originalQueue: get().shuffle ? get().originalQueue : queue 
    });
  },

  nextTrack: () => {
    const { queue, currentIndex, repeat, currentTrack } = get();
    if (queue.length === 0) return;

    if (repeat === 'one' && currentTrack) {
      // Re-trigger current track by resetting progress briefly or just keeping it
      set({ progress: 0, isPlaying: true });
      return;
    }

    let nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        // End of queue and no repeat
        set({ isPlaying: false, progress: 0 });
        return;
      }
    }

    set({
      currentTrack: queue[nextIndex],
      currentIndex: nextIndex,
      isPlaying: true,
      progress: 0,
    });
  },

  prevTrack: () => {
    const { queue, currentIndex, progress } = get();
    if (queue.length === 0) return;

    // If song is more than 3 seconds in, restart it
    if (progress > 3) {
      set({ progress: 0 });
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1; // Wrap around
    }

    set({
      currentTrack: queue[prevIndex],
      currentIndex: prevIndex,
      isPlaying: true,
      progress: 0,
    });
  },

  setVolume: (volume) => set({ volume }),
  
  setProgress: (progress) => set({ progress }),
  
  setDuration: (duration) => set({ duration }),
  
  setShowVideo: (showVideo) => set({ showVideo }),
  
  toggleMuted: () => set((state) => ({ muted: !state.muted })),
  
  setRepeat: (repeat) => set({ repeat }),

  toggleShuffle: () => {
    const { shuffle, queue, originalQueue, currentTrack } = get();
    if (queue.length === 0) return;

    if (!shuffle) {
      // Enable shuffle: randomize queue but keep currentTrack at index 0
      const filtered = queue.filter((t) => t.videoId !== currentTrack?.videoId);
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      const newQueue = currentTrack ? [currentTrack, ...shuffled] : shuffled;
      
      set({
        shuffle: true,
        originalQueue: queue, // Save current queue order
        queue: newQueue,
        currentIndex: currentTrack ? 0 : -1,
      });
    } else {
      // Disable shuffle: restore original queue and find index of currentTrack
      const newIndex = originalQueue.findIndex((t) => t.videoId === currentTrack?.videoId);
      set({
        shuffle: false,
        queue: originalQueue,
        currentIndex: newIndex,
      });
    }
  },

  addToQueue: (track) => {
    const { queue } = get();
    if (queue.some((t) => t.videoId === track.videoId)) return; // Avoid duplicates
    
    set({
      queue: [...queue, track],
      originalQueue: get().shuffle ? get().originalQueue : [...queue, track],
    });
  },

  clearQueue: () => set({ queue: [], originalQueue: [], currentIndex: -1, currentTrack: null, isPlaying: false, progress: 0 }),
}));
