import { useEffect, useRef } from "react";

const DEFAULT_PUSH_SOUND_URL = "/manus-storage/notification-motoboy_31cd6501.mp3";

export function PushAudioBridge() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(DEFAULT_PUSH_SOUND_URL);
    audio.preload = "auto";
    audioRef.current = audio;

    return () => {
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlockAudio = async () => {
      if (unlockedRef.current || !audioRef.current) return;
      const audio = audioRef.current;
      audio.muted = true;

      try {
        audio.currentTime = 0;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        unlockedRef.current = true;
      } catch {
        // Browsers may still block until the user interacts more explicitly.
      } finally {
        audio.muted = false;
      }
    };

    const unlockEvents = ["pointerdown", "touchstart", "keydown"];
    unlockEvents.forEach((eventName) =>
      window.addEventListener(eventName, unlockAudio, { passive: true })
    );

    return () => {
      unlockEvents.forEach((eventName) =>
        window.removeEventListener(eventName, unlockAudio)
      );
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "BONATTO_PUSH_SOUND") return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const soundUrl =
        typeof data.soundUrl === "string" && data.soundUrl.trim()
          ? data.soundUrl
          : DEFAULT_PUSH_SOUND_URL;

      const audio = audioRef.current;
      if (!audio) return;

      try {
        const absoluteSoundUrl = new URL(soundUrl, window.location.origin).toString();
        if (audio.src !== absoluteSoundUrl) {
          audio.src = absoluteSoundUrl;
        }
      } catch {
        audio.src = soundUrl;
      }

      audio.currentTime = 0;
      audio.play().catch(() => {
        // If autoplay is blocked, the silent notification still appears.
      });

      if (navigator.vibrate) {
        navigator.vibrate([180, 100, 180]);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
