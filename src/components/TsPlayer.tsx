import React, { useEffect, useRef, useState } from 'react';
import mpegts from 'mpegts.js';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface TsPlayerProps {
  tsUrl: string;
  m3u8Url: string;
  autoPlay?: boolean;
}

export function TsPlayer({ tsUrl, m3u8Url, autoPlay = true }: TsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !tsUrl) return;

    setHasError(false);
    setIsReady(false);

    // Destructuration de l'ancien lecteur si existant
    if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
    }

    if (mpegts.getFeatureList().mseLivePlayback) {
      // Configuration optimale pour MPEG-TS Continu (IPTV)
      const player = mpegts.createPlayer({
        type: 'm2ts', // m2ts = MPEG2-TS brut
        isLive: true,
        hasAudio: true,
        hasVideo: true,
        url: tsUrl
      }, {
        enableWorker: true,
        enableStashBuffer: false, // Empêche le buffering infini
        stashInitialSize: 128,
        lazyLoadMaxDuration: 3 * 60,
        seekType: 'range',
        liveBufferLatencyChasing: true, // Aide à rattraper si décalage
        liveBufferLatencyMaxLatency: 2.5, // Force la lecture si la latence dépasse 2.5s
      });

      playerRef.current = player;
      player.attachMediaElement(video);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errType, errDetail) => {
         console.warn('MPEG-TS Erreur (Tentative de reconnexion auto):', errType, errDetail);
         // Plutôt que de planter, on tente une re-synchronisation transparente locale
         if (playerRef.current) {
             playerRef.current.unload();
             playerRef.current.load();
             playerRef.current.play().catch(() => {});
         }
      });

      player.on(mpegts.Events.MEDIA_INFO, () => {
         setIsReady(true);
         setHasError(false);
         if (autoPlay) {
           video.play().catch(e => console.log('Autorisation lecture requise:', e));
         }
      });

      return () => {
        player.destroy();
        playerRef.current = null;
      };
    } 
    // Fallback Natif Safari (Mac/iOS gèrent le TS/HLS facilement)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8Url;
      video.addEventListener('canplay', () => {
        setIsReady(true);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });
      video.addEventListener('error', () => setHasError(true));
    } else {
      setHasError(true);
    }
  }, [tsUrl, m3u8Url, autoPlay]);

  return (
    <div className="relative group overflow-hidden rounded-xl border border-[#1F2833] bg-black aspect-video shadow-2xl">
      {!isReady && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/80 backdrop-blur-sm z-10 text-[#45A29E] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#66FCF1]" />
          <span className="font-medium text-xs uppercase tracking-widest">Mise en mémoire tampon...</span>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md z-10 text-center gap-2 p-6">
          <AlertCircle className="w-10 h-10 mb-2 text-red-400" />
          <h3 className="text-xs uppercase tracking-widest font-bold text-red-400">Erreur de Lecteur</h3>
          <p className="text-sm opacity-80 max-w-sm text-red-200">
             Le navigateur ne supporte pas ce décodage ou les données sont corrompues. Utilisez VLC en copiant le lien généré.
          </p>
        </div>
      )}
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
