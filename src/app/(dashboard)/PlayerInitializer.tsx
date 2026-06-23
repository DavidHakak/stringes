'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';

export default function PlayerInitializer({ showVideo }: { showVideo: boolean }) {
  const setShowVideo = usePlayerStore((state) => state.setShowVideo);

  useEffect(() => {
    setShowVideo(showVideo);
  }, [showVideo, setShowVideo]);

  return null;
}
