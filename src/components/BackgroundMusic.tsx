
import { useEffect, useRef } from "react";

type Props = {
  muted: boolean;
};

export default function BackgroundMusic({ muted }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const audio = new Audio("/audio/bgm.mp3");

    audio.loop = true;
    audio.volume = 0.2;
    audio.preload = "auto";

    audioRef.current = audio;

    const startMusic = () => {
      if (!mutedRef.current && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    // Start music on the first user interaction.
    window.addEventListener("pointerdown", startMusic);

    return () => {
      window.removeEventListener("pointerdown", startMusic);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (muted) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [muted]);

  return null;
}
