import { useState } from 'react';
import { Settings2, Activity, PlayCircle, RefreshCw, Layers, Copy, CheckCircle } from 'lucide-react';
import { TsPlayer } from './components/TsPlayer';

export default function App() {
  const [sourceUrl, setSourceUrl] = useState('http://foxbleu.org/live/josealbino/21321/13917.ts');
  const [generatedTsUrl, setGeneratedTsUrl] = useState('');
  const [generatedM3u8Url, setGeneratedM3u8Url] = useState('');
  const [copiedLink, setCopiedLink] = useState<'ts' | 'm3u8' | null>(null);

  const handleGenerate = () => {
    if (!sourceUrl) return;
    const encoded = encodeURIComponent(sourceUrl);
    // On génère une URL absolue pour que ce soit facile à copier vers VLC
    const baseUrl = window.location.origin;
    setGeneratedTsUrl(`${baseUrl}/api/proxy/stream.ts?url=${encoded}`);
    setGeneratedM3u8Url(`${baseUrl}/api/proxy/playlist.m3u8?url=${encoded}`);
  };

  const copyToClipboard = (url: string, type: 'ts' | 'm3u8') => {
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        
        <header className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1F2833]/50 text-[#66FCF1] rounded-full text-xs font-semibold tracking-wider font-display uppercase mb-2 border border-[#66FCF1]/20">
            <Activity className="w-4 h-4" />
            Moteur Anti-Coupure (Seamless Bridge)
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-white">
            Générateur Proxy IPTV Continu
          </h1>
          <p className="text-[#C5C6C7] max-w-2xl text-sm md:text-base leading-relaxed">
            Ce système répond au problème classique des flux IPTV qui coupent la connexion intentionnellement
            toutes les 15 ou 20 secondes. Notre serveur capture ces déconnexions pour vous, et <b>reconnecte 
            immédiatement la source</b> de façon invisible. Que vous lisiez le flux sur le navigateur web ou VLC.
          </p>
        </header>

        <div className="grid md:grid-cols-[1fr,1.5fr] gap-8 items-start">
          
          <div className="bg-[#121212] border border-[#1F2833] rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center gap-3 text-white border-b border-[#1F2833] pb-4">
              <Settings2 className="w-5 h-5 text-[#66FCF1]" />
              <h2 className="text-lg font-display font-semibold">Configuration Source</h2>
            </div>

            <div className="space-y-5 text-sm">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold block">
                  Lien du Segment Brut (.ts) ou Serveur
                </label>
                <textarea 
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full h-24 bg-[#0B0C10] border border-[#1F2833] rounded-lg p-3 text-white font-mono text-xs break-all focus:outline-none focus:ring-1 focus:ring-[#66FCF1]/50 resize-none"
                  placeholder="http://foxbleu.org/live/..."
                />
              </div>

              <div className="pt-2 text-xs text-[#45A29E] opacity-90 leading-relaxed border-l-2 border-[#1F2833] pl-3">
                Une fois généré, notre proxy téléchargera le TS sans fin, effaçant toute petite coupure que votre fournisseur tente d'imposer.
              </div>

              <button 
                onClick={handleGenerate}
                className="w-full bg-[#66FCF1] hover:bg-[#45A29E] text-[#0B0C10] font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-[0.98] mt-4 shadow-lg shadow-[#66FCF1]/10"
              >
                <RefreshCw className="w-4 h-4" />
                Démarrer le Pont Proxy
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {!generatedTsUrl ? (
              <div className="aspect-video bg-[#121212]/50 border border-[#1F2833]/50 rounded-2xl flex flex-col items-center justify-center text-[#45A29E] gap-4 border-dashed relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#66FCF1]/5 to-transparent opacity-50" />
                <PlayCircle 
                  className="w-16 h-16 opacity-30 cursor-pointer hover:opacity-100 transition-opacity" 
                  onClick={handleGenerate} 
                />
                <p className="text-sm font-medium">Configurez et générez le pont pour voir les liens ininterrompus</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                
                <div className="bg-[#121212] border border-[#1F2833] rounded-xl p-4 flex flex-col gap-3 shadow-xl relative overflow-hidden">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#66FCF1]" />
                    <h3 className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold">Liens Sécurisés (Idéal pour VLC)</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Lien Brut TS */}
                    <div className="flex items-center gap-2 bg-[#0B0C10] p-2.5 rounded-lg border border-[#1F2833] hover:border-[#45A29E]/50 transition-colors">
                      <span className="text-[10px] font-bold text-[#66FCF1] bg-[#1F2833] px-2 py-0.5 rounded uppercase">TS Live</span>
                      <span className="flex-1 font-mono text-[11px] text-[#C5C6C7] line-clamp-1">{generatedTsUrl}</span>
                      <button 
                        onClick={() => copyToClipboard(generatedTsUrl, 'ts')} 
                        className="p-1.5 hover:bg-[#1F2833] rounded text-[#45A29E] transition-colors flex-shrink-0"
                        title="Copier le lien TS"
                      >
                        {copiedLink === 'ts' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Alias M3U8 */}
                    <div className="flex items-center gap-2 bg-[#0B0C10] p-2.5 rounded-lg border border-[#1F2833] hover:border-[#45A29E]/50 transition-colors">
                      <span className="text-[10px] font-bold text-[#45A29E] bg-[#1F2833] px-2 py-0.5 rounded uppercase">M3U8</span>
                      <span className="flex-1 font-mono text-[11px] text-[#C5C6C7] line-clamp-1">{generatedM3u8Url}</span>
                      <button 
                        onClick={() => copyToClipboard(generatedM3u8Url, 'm3u8')} 
                        className="p-1.5 hover:bg-[#1F2833] rounded text-[#45A29E] transition-colors flex-shrink-0"
                        title="Copier le lien M3U8"
                      >
                        {copiedLink === 'm3u8' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                   <h3 className="text-[10px] uppercase tracking-widest text-[#45A29E] font-bold px-1">Visualisation Web (Expérimentale)</h3>
                   <TsPlayer tsUrl={generatedTsUrl} m3u8Url={generatedM3u8Url} autoPlay={true} />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
