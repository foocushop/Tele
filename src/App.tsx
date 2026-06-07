import { useState } from 'react';
import { PlayCircle, ShieldCheck } from 'lucide-react';
import { TsPlayer } from './components/TsPlayer';

export default function App() {
  const [sourceUrl, setSourceUrl] = useState('http://foxbleu.org/live/josealbino/21321/13917.ts');
  const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(null);

  const startStream = () => {
    if (!sourceUrl) return;
    const encoded = encodeURIComponent(sourceUrl);
    // On utilise FFMPEG pour transcoder élégamment le flux iptv en direct et supprimer les erreurs de timestamps / coupures
    setActiveStreamUrl(`/api/proxy/live.m3u8?url=${encoded}`);
  };

  const isLive = activeStreamUrl !== null;

  return (
    <div className="bg-[#0B0C10] text-[#C5C6C7] font-sans w-full h-screen flex flex-col overflow-hidden">
      
      {/* Navigation Top Bar */}
      <nav className="h-16 shrink-0 border-b border-[#1F2833] flex items-center justify-between px-4 sm:px-8 bg-[#121212]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex shrink-0 items-center justify-center rounded">
            <svg className="w-6 h-6 text-[#66FCF1]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white hidden sm:block">
            STREAM<span className="text-[#66FCF1]">FLUX</span> CACHE
          </span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#45A29E] font-bold">
              Engine Status: {isLive ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
        
        {/* Sidebar Configuration */}
        <aside className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-[#1F2833] bg-[#0B0C10] p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto">
          
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Source du segment (IPTV .TS)
            </div>
            
            <textarea 
              value={sourceUrl}
              onChange={(e) => {
                 setSourceUrl(e.target.value);
                 setActiveStreamUrl(null);
              }}
              className="w-full h-24 bg-[#121212] border border-[#1F2833] rounded p-3 text-white font-mono text-xs break-all focus:outline-none focus:border-[#66FCF1] resize-none transition-colors"
              placeholder="http://foxbleu.org/live/..."
            />
          </div>

          <div className="bg-[#1F2833]/30 p-4 rounded border border-[#66FCF1]/10 text-xs leading-relaxed opacity-90">
             <span className="text-[#66FCF1] font-bold block mb-1">Système Anti-Coupure (Web)</span>
             Ce lecteur web télécharge continuellement le fichier TS par un flux proxy. Lorsque la coupure de ~20s intervient, le pont invisible reconnecte la source instantanément sans figer le lecteur.
          </div>

          <div className="mt-auto pt-6">
            <button 
               onClick={startStream}
               className="w-full py-4 bg-[#66FCF1] hover:bg-[#45A29E] text-[#0B0C10] font-bold uppercase tracking-widest rounded text-xs transition-colors shadow-lg shadow-[#66FCF1]/10"
            >
               {isLive ? 'Redémarrer le Flux' : 'Démarrer le Flux Web'}
            </button>
          </div>
        </aside>

        {/* Video Player Main View */}
        <main className="flex-1 flex flex-col bg-[#121212] overflow-hidden p-4 sm:p-6 relative">
          
          <div className="flex-1 bg-black rounded-xl border border-[#1F2833] relative flex items-center justify-center overflow-hidden shadow-2xl">
            
            {!isLive ? (
               <div className="flex flex-col items-center gap-4 opacity-50 transition-opacity hover:opacity-100 cursor-pointer" onClick={startStream}>
                  <PlayCircle className="w-16 h-16 text-[#1F2833]" />
                  <span className="text-xs uppercase tracking-widest text-[#45A29E] font-bold">En attente du flux</span>
               </div>
            ) : (
               <TsPlayer streamUrl={activeStreamUrl!} />
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex gap-2 z-20 pointer-events-none">
              <span className={`px-2 py-1 text-white text-[10px] font-bold rounded ${isLive ? 'bg-red-600' : 'bg-zinc-800'}`}>
                 LIVE
              </span>
              {isLive && <span className="px-2 py-1 bg-black/80 text-white text-[10px] font-bold rounded backdrop-blur border border-white/10 uppercase tracking-widest">
                 Seamless Bridge
              </span>}
            </div>

          </div>

          {/* System Logs Fake visual UI */}
          {isLive && (
             <div className="h-40 shrink-0 mt-6 bg-[#0B0C10] border border-[#1F2833] rounded-lg p-4 flex flex-col hidden sm:flex">
               <div className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold mb-3">System Logs (Pont Seamless)</div>
               <div className="text-[10px] text-[#C5C6C7] space-y-1.5 opacity-80 font-mono overflow-y-auto">
                 <p className="text-[#66FCF1]">[INIT] Connexion au port proxy local établie.</p>
                 <p>[STREAM] Capture du flux {sourceUrl.split('/').pop()} en cours...</p>
                 <p>[BUFFER] Paramétrage "X-Accel-Buffering" à "No" (Bypass NGINX).</p>
                 <p className="text-[#45A29E]">[LISSAGE] Concaténation infinie activée. Pare-chocs réseau en veille.</p>
               </div>
             </div>
          )}

        </main>
      </div>

      {/* Footer */}
      <footer className="h-10 shrink-0 border-t border-[#1F2833] bg-[#0B0C10] px-4 sm:px-8 flex items-center justify-between text-[10px] text-[#45A29E] uppercase tracking-widest font-bold">
        <div>STREAMING INTERFACE v3.1.0-WEB</div>
        <div className="flex gap-4 items-center">
          <span className="hidden sm:inline">Node.js Seamless Relay</span>
        </div>
      </footer>

    </div>
  );
}

