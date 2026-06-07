import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle } from 'lucide-react';

interface TsPlayerProps {
  streamUrl: string;
}

export function TsPlayer({ streamUrl }: TsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Hls | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setHasError(false);
    setIsReady(false);

    // Initialisation HLS.js
    if (Hls.isSupported()) {
      const hls = new Hls({
         // Paramètres pour un live ultra agressif (IPTV proxy local)
         lowLatencyMode: true,
         backBufferLength: 30, // Ne garde que 30s de passif pour économiser la RAM
         liveDurationInfinity: true,
         maxLiveSyncPlaybackRate: 1.5,
      });

      playerRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
         setIsReady(true);
         setHasError(false);
         video.play().catch(e => console.log('Autorisation lecture requise:', e));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
         if (data.fatal) {
           switch (data.type) {
             case Hls.ErrorTypes.NETWORK_ERROR:
               console.warn('[HLS] Erreur réseau (fatal). Tentative de récupération...');
               hls.startLoad();
               break;
             case Hls.ErrorTypes.MEDIA_ERROR:
               console.warn('[HLS] Erreur de média (timestamp/discontinuité fatal). Récupération...');
               hls.recoverMediaError();
               break;
             default:
               console.error('[HLS] Erreur irrécupérable.');
               hls.destroy();
               setHasError(true);
               break;
           }
         } else {
             console.warn('[HLS] Erreur non fatale:', data);
         }
      });

      return () => {
        hls.destroy();
        playerRef.current = null;
      };
    } 
    // Fallback Apple (Safari/iOS) natif
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
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
