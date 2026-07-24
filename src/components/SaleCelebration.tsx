'use client';

import Image from 'next/image';
import { useEffect } from 'react';

const CELEBRATION_DURATION_MS = 5_000;

export function SaleCelebration({ leadName, onClose }: { leadName: string; onClose: () => void }) {
  useEffect(() => {
    const engine = new Audio('/effects/sale-engine.mp3');
    const money = new Audio('/effects/sale-money.mp3');
    let finished = false;
    engine.preload = money.preload = 'auto';
    engine.volume = 0.58;
    money.volume = 0.82;

    const playAt = (audio: HTMLAudioElement, time: number) => {
      const play = () => {
        if (finished) return;
        audio.currentTime = time;
        void audio.play().catch(() => undefined);
      };
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) play();
      else audio.addEventListener('loadedmetadata', play, { once: true });
      audio.load();
      return () => audio.removeEventListener('loadedmetadata', play);
    };

    const removeEngineMetadata = playAt(engine, 11);
    const removeMoneyMetadata = playAt(money, 5);

    function stopAndClose() {
      if (finished) return;
      finished = true;
      removeEngineMetadata();
      removeMoneyMetadata();
      engine.pause();
      engine.currentTime = 0;
      money.pause();
      money.currentTime = 0;
      onClose();
    }

    const timer = window.setTimeout(stopAndClose, CELEBRATION_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      finished = true;
      removeEngineMetadata();
      removeMoneyMetadata();
      engine.pause();
      money.pause();
    };
  }, [onClose]);

  return (
    <button
      type="button"
      onClick={onClose}
      role="status"
      aria-live="assertive"
      className="sale-celebration fixed inset-0 z-[100] overflow-hidden bg-slate-950/90 backdrop-blur-sm motion-reduce:transition-none"
    >
      <div className="sale-speed-lines" aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <span className="sale-kicker">NEGÓCIO CONCLUÍDO</span>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
          Parabéns pela venda!
        </h2>
        <p className="mt-2 text-base text-slate-300">
          {leadName} avançou para a linha de chegada.
        </p>
        <div className="sale-car-stage mt-8" aria-hidden="true">
          <div className="sale-car-glow" />
          <Image
            className="sale-car sale-car-right-to-left"
            src="/effects/sale-car-neon.png"
            alt=""
            width={1536}
            height={1024}
            priority
            style={{ animationDuration: `${CELEBRATION_DURATION_MS}ms` }}
          />
        </div>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">
          Clique para continuar
        </p>
      </div>
    </button>
  );
}
