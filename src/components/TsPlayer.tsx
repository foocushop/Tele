import React, { useEffect, useRef, useState } from 'react';
import mpegts from 'mpegts.js';
import { Loader2, AlertCircle } from 'lucide-react';

interface TsPlayerProps {
  streamUrl: string;
}

export function TsPlayer({ streamUrl }: TsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setHasError(false);
    setIsReady(false);

    // Nettoyage de l'ancien lecteur si nécessaire
    if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
    }

    if (mpegts.getFeatureList().mseLivePlayback) {
      // Optimisation pour streaming continu en direct
      const player = mpegts.createPlayer({
        type: 'm2ts', // m2ts = MPEG2-TS (IPTV)
        isLive: true,
        url: streamUrl,
      }, {
        enableWorker: true,            // Performant pour la vidéo
        enableStashBuffer: false,      // Empêche le buffering infini
        stashInitialSize: 128,         
        liveBufferLatencyChasing: true, // Aide à rester "En direct"
      });

      playerRef.current = player;
      player.attachMediaElement(video);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errType, errDetail) => {
         console.warn('MPEG-TS Erreur ou Reconnexion:', errType, errDetail);
         // Auto-recovery brutal si le lecteur freeze
         if (playerRef.current) {
             playerRef.current.unload();
             playerRef.current.load();
             playerRef.current.play().catch(() => {});
         }
      });

      player.on(mpegts.Events.MEDIA_INFO, () => {
         setIsReady(true);
         setHasError(false);
         video.play().catch(e => console.log('Autorisation lecture requise (cliquez Play):', e));
      });

      return () => {
        player.destroy();
        playerRef.current = null;
      };
    } 
    // Fallback Mac Safari / iOS natif
    else if (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('video/mp2t')) {
      video.src = streamUrl;
      video.addEventListener('canplay', () => {
        setIsReady(true);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => setHasError(true));
    } else {
      setHasError(true);
    }
  }, [streamUrl]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      {!isReady && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/90 backdrop-blur z-10 text-[#45A29E] gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#66FCF1]" />
          <span className="font-bold text-[10px] uppercase tracking-widest text-[#66FCF1]">Connexion et Lissage du Flux...</span>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/90 backdrop-blur z-10 p-6 text-center">
             <AlertCircle className="w-6 h-6 mr-3 text-red-500" />
             <span className="text-xs uppercase tracking-widest font-bold text-red-500">Flux Incompatible (Vérifiez le lien)</span>
        </div>
      )}

      {/* Vidéo intégrée */}
      <video
        ref={videoRef}
        controls
        playsInline
        className={`w-full h-full object-contain transition-opacity duration-1000 ${!isReady ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
