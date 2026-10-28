
import { useCallback, useEffect, useRef } from "react";

type SoundName =
  | "blinds"
  | "lamp"
  | "pet"
  | "feed"
  | "play"
  | "sleep";

type SoundConfig = {
  file: string;
  volume: number;
  duration: number;
};

const SOUND_CONFIG: Record<SoundName, SoundConfig> = {
  blinds: {
    file: "/audio/blinds-click.mp3",
    volume: 0.4,
    duration: 0.7,
  },
  lamp: {
    file: "/audio/switch-click.mp3",
    volume: 0.35,
    duration: 0.5,
  },
  pet: {
    file: "/audio/pet-sound.mp3",
    volume: 0.45,
    duration: 0.8,
  },
  feed: {
    file: "/audio/munching.mp3",
    volume: 0.4,
    duration: 2,
  },
  play: {
    file: "/audio/play-sound.mp3",
    volume: 0.4,
    duration: 2,
  },
  sleep: {
    file: "/audio/sleep-snore.mp3",
    volume: 0.3,
    duration: 3,
  },
};

export function useSoundEffects() {
  const audioRef = useRef<
    Partial<Record<SoundName, HTMLAudioElement>>
  >({});

  const timersRef = useRef<
    Partial<Record<SoundName, ReturnType<typeof setTimeout>>>
  >({});

  useEffect(() => {
    const audios: Partial<
      Record<SoundName, HTMLAudioElement>
    > = {};

    (
      Object.keys(SOUND_CONFIG) as SoundName[]
    ).forEach((name) => {
      const config = SOUND_CONFIG[name];
      const audio = new Audio(config.file);

      audio.volume = config.volume;
      audio.preload = "auto";

      audios[name] = audio;
    });

    audioRef.current = audios;

    return () => {
      Object.values(timersRef.current).forEach(
        (timer) => {
          if (timer !== undefined) {
            clearTimeout(timer);
          }
        }
      );

      Object.values(audios).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });

      audioRef.current = {};
      timersRef.current = {};
    };
  }, []);

  const stopSound = useCallback((name: SoundName) => {
    const timer = timersRef.current[name];

    if (timer !== undefined) {
      clearTimeout(timer);
      delete timersRef.current[name];
    }

    const audio = audioRef.current[name];

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const playSound = useCallback(
    (name: SoundName) => {
      const audio = audioRef.current[name];
      const config = SOUND_CONFIG[name];

      if (!audio) return;

      stopSound(name);

      audio.play().catch(() => {});

      timersRef.current[name] = setTimeout(() => {
        stopSound(name);
      }, config.duration * 1000);
    },
    [stopSound]
  );

  return {
    playSound,
    stopSound,
  };
}
