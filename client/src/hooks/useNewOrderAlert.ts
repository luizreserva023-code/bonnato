import { useEffect, useRef, useCallback } from "react";

/**
 * Gera um som "ding" usando a Web Audio API (sem arquivo externo).
 * Dois osciladores sobrepostos produzem um timbre de sino suave.
 */
function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(gain, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Sino principal + harmônico
    playTone(880, ctx.currentTime, 1.2, 0.5);
    playTone(1320, ctx.currentTime, 0.8, 0.25);
    // Segundo "ding" após 0.4s
    playTone(880, ctx.currentTime + 0.4, 1.0, 0.35);
    playTone(1320, ctx.currentTime + 0.4, 0.7, 0.18);
  } catch {
    // Silenciosamente ignora se o contexto de áudio não estiver disponível
  }
}

/**
 * Hook que detecta novos pedidos e dispara alerta sonoro + piscar do título.
 *
 * @param orderIds - Lista de IDs dos pedidos atuais (do polling do tRPC)
 * @param enabled  - Só ativa quando o usuário está na aba Admin
 */
export function useNewOrderAlert(orderIds: number[] | undefined, enabled: boolean) {
  const prevIdsRef = useRef<Set<number> | null>(null);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitleRef = useRef<string>(document.title);
  const isFlashingRef = useRef(false);

  const stopAlert = useCallback(() => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    document.title = originalTitleRef.current;
    isFlashingRef.current = false;
  }, []);

  // Parar alerta ao clicar em qualquer lugar
  useEffect(() => {
    const handler = () => {
      if (isFlashingRef.current) stopAlert();
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [stopAlert]);

  useEffect(() => {
    if (!enabled || orderIds === undefined) return;

    const currentIds = new Set(orderIds);

    // Primeira carga: apenas inicializa a referência, sem disparar alerta
    if (prevIdsRef.current === null) {
      prevIdsRef.current = currentIds;
      return;
    }

    // Detectar IDs novos (presentes agora mas não antes)
    const newIds: number[] = [];
    currentIds.forEach(id => {
      if (!prevIdsRef.current!.has(id)) newIds.push(id);
    });

    if (newIds.length > 0) {
      // Som
      playDing();

      // Piscar título
      if (!isFlashingRef.current) {
        isFlashingRef.current = true;
        originalTitleRef.current = document.title;
        let toggle = true;
        flashIntervalRef.current = setInterval(() => {
          document.title = toggle ? "🔔 Novo Pedido!" : originalTitleRef.current;
          toggle = !toggle;
        }, 800);
      }
    }

    prevIdsRef.current = currentIds;
  }, [orderIds, enabled]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => stopAlert();
  }, [stopAlert]);

  return { stopAlert };
}
