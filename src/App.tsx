import { useState } from 'react';
import { Settings2, Activity, PlayCircle, RefreshCw, Layers } from 'lucide-react';
import { HlsPlayer } from './components/HlsPlayer';

export default function App() {
  const [sourceUrl, setSourceUrl] = useState('http://foxbleu.org/live/josealbino/21321/13917.ts');
  const [duration, setDuration] = useState<number>(15);
  const [generatedUrl, setGeneratedUrl] = useState('');

  // Génère le lien vers notre serveur proxy interne
  const handleGenerate = () => {
    if (!sourceUrl) return;
    
    // Le frontend fait appel à l'API Express qui gère le glissement et le cache
    const newUrl = `/api/generator/live.m3u8?url=${encodeURIComponent(sourceUrl)}&duration=${duration}`;
    setGeneratedUrl(newUrl);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        
        {/* Entête */}
        <header className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1F2833]/50 text-[#66FCF1] rounded-full text-xs font-semibold tracking-wider font-display uppercase mb-2 border border-[#66FCF1]/20">
            <Activity className="w-4 h-4" />
            Moteur de Rétention Live
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-white">
            Générateur de Flux HLS Continu
          </h1>
          <p className="text-[#C5C6C7] max-w-2xl text-sm md:text-base leading-relaxed">
            Ce système produit une playlist M3U8 dynamique qui ne s'actualise pas à chaque fin de flux. 
            Il intègre un proxy qui force le lecteur vidéo à mettre le segment en mémoire tampon et 
            télécharge la suite indéfiniment en respectant la boucle désirée.
          </p>
        </header>

        <div className="grid md:grid-cols-[1fr,1.5fr] gap-8 items-start">
          
          {/* Panneau de configuration */}
          <div className="bg-[#121212] border border-[#1F2833] rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center gap-3 text-white border-b border-[#1F2833] pb-4">
              <Settings2 className="w-5 h-5 text-[#66FCF1]" />
              <h2 className="text-lg font-display font-semibold">Configuration Source</h2>
            </div>

            <div className="space-y-5 text-sm">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold block">Lien du Segment Brut (.ts)</label>
                <textarea 
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full h-24 bg-[#0B0C10] border border-[#1F2833] rounded-lg p-3 text-white font-mono text-xs break-all focus:outline-none focus:ring-1 focus:ring-[#66FCF1]/50 resize-none"
                  placeholder="http://..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold flex items-center justify-between">
                  <span>Cycle de Téléchargement</span>
                  <span className="text-[#66FCF1] font-mono bg-[#1F2833] px-2 py-0.5 rounded text-xs">
                    {duration} Secondes
                  </span>
                </label>
                <div className="pt-2">
                  <input 
                    type="range" 
                    min="5" 
                    max="60" 
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full accent-[#45A29E] cursor-pointer"
                  />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-[#45A29E] opacity-80 leading-snug">
                  Le lecteur gardera le M3U en cache et demandera un nouveau morceau toutes les {duration}s.
                </p>
              </div>

              <button 
                onClick={handleGenerate}
                className="w-full bg-[#66FCF1] hover:bg-[#45A29E] text-[#0B0C10] font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-[0.98] mt-4 shadow-lg shadow-[#66FCF1]/10"
              >
                <RefreshCw className="w-4 h-4" />
                Démarrer le moteur de flux
              </button>
            </div>
          </div>

          {/* Espace Visuel & Lecteur */}
          <div className="space-y-6">
            {!generatedUrl ? (
              <div className="aspect-video bg-[#121212]/50 border border-[#1F2833]/50 rounded-2xl flex flex-col items-center justify-center text-[#45A29E] gap-4 border-dashed relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#66FCF1]/5 to-transparent opacity-50" />
                <PlayCircle className="w-16 h-16 opacity-30" />
                <p className="text-sm font-medium">Configurez et démarrez le flux pour visualiser le lecteur</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                
                {/* Zone de Code (Status M3U8) */}
                <div className="bg-[#121212] border border-[#1F2833] rounded-xl p-4 flex gap-4 items-start shadow-xl relative overflow-hidden">
                  <Layers className="w-5 h-5 text-[#66FCF1] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold">Session Live Active</h3>
                    <p className="text-xs text-[#C5C6C7] line-clamp-1 break-all">
                      Playlist : <span className="font-mono text-[#66FCF1]">{generatedUrl}</span>
                    </p>
                  </div>
                </div>

                {/* Le vrai composant HLS */}
                <HlsPlayer src={generatedUrl} autoPlay={true} />

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
