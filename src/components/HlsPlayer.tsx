import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface HlsPlayerProps {
  src: string;
  autoPlay?: boolean;
}

export function HlsPlayer({ src, autoPlay = true }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Réinitialisation des états
    setHasError(false);
    setIsReady(false);

    if (Hls.isSupported()) {
      // Configuration d'HLS.js selon votre demande :
      // Ces réglages permettent de "garder en cache" et de télécharger en continu
      const hls = new Hls({
        debug: false,
        maxBufferLength: 30, // Conserve 30 secondes en cache pour ne pas s'arrêter
        maxMaxBufferLength: 600,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 15, // Tolérance de latence
      });

      hlsRef.current = hls;
      
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true);
        if (autoPlay) {
          video.play().catch(e => console.log('Autorisation requise pour la lecture:', e));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Erreur réseau, tentative de récupération...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Erreur média, récupération...');
              hls.recoverMediaError();
              break;
            default:
              setHasError(true);
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } 
    // Fallback pour Safari (iPhone) qui gère le HLS nativement
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('canplay', () => {
        setIsReady(true);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });
      video.addEventListener('error', () => setHasError(true));
    }
  }, [src, autoPlay]);

  return (
    <div className="relative group overflow-hidden rounded-xl border border-[#1F2833] bg-black aspect-video shadow-2xl">
      {/* Messages de chargement et d'erreur */}
      {!isReady && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/80 backdrop-blur-sm z-10 text-[#45A29E] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#66FCF1]" />
          <span className="font-medium text-xs uppercase tracking-widest">Mise en mémoire tampon...</span>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md z-10 text-red-200 p-6 text-center gap-2">
          <AlertCircle className="w-10 h-10 mb-2 text-red-400" />
          <h3 className="text-xs uppercase tracking-widest font-bold text-red-400">Erreur de Flux</h3>
          <p className="text-sm opacity-80 max-w-sm">Le lecteur n'a pas pu se connecter au segment vidéo. Vérifiez que la source TS est accessible.</p>
        </div>
      )}

      {/* Lecteur Vidéo */}
      <video
        ref={videoRef}
        controls
        playsInline
        className={cn(
          "w-full h-full object-contain transition-opacity duration-700",
          !isReady ? "opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
}
