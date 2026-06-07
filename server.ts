import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import https from 'https';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Endpoint API : Générateur HLS Live (M3U8)
  // Produit un flux continu (sans fin) à partir d'un segment TS pour éviter la coupure
  app.get('/api/generator/live.m3u8', (req, res) => {
    // Lien TS cible (source)
    const targetTs = typeof req.query.url === 'string' && req.query.url 
      ? req.query.url 
      : 'http://foxbleu.org/live/josealbino/21321/13917.ts';
    
    // Durée de rafraîchissement / segment (ex: 15s ou 20s) fournie par l'utilisateur
    const chunkDuration = parseInt(req.query.duration as string, 10) || 15;

    // Astuce cruciale : Calcul de la séquence média actuelle basée sur le temps réel (Epoch)
    // Cela trompe le lecteur vidéo : chaque fois qu'il reverra ce .m3u8 (toutes les X secondes),
    // la séquence aura avancé. Il continuera donc de télécharger le flux en boucle, le gardant en cache
    // sans jamais s'actualiser complètement ou crasher.
    const nowSec = Math.floor(Date.now() / 1000);
    const sequence = Math.floor(nowSec / chunkDuration);

    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:3\n";
    m3u8 += `#EXT-X-TARGETDURATION:${chunkDuration}\n`;
    m3u8 += `#EXT-X-MEDIA-SEQUENCE:${sequence}\n`;

    const encodedUrl = encodeURIComponent(targetTs);

    // Fenêtre glissante : On déclare que les 3 segments actuels sont disponibles
    // Le lecteur les gardera dans son cache vidéo au fur et à mesure.
    for (let i = 0; i < 3; i++) {
        m3u8 += `#EXTINF:${chunkDuration}.0,\n`;
        // On redirige vers notre proxy interne pour contourner les erreurs CORS du navigateur !
        m3u8 += `/api/generator/chunk.ts?url=${encodedUrl}\n`;
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.send(m3u8);
  });

  // Endpoint API : Proxy de morceau de vidéo (TS Chunk Proxy)
  // Ce proxy prend le vrai lien foxbleu.org, le télécharge en direct et le passe au lecteur
  app.get('/api/generator/chunk.ts', (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("No url provided");

    const client = targetUrl.startsWith('https') ? https : http;
    
    // On requête le serveur cible en direct
    client.get(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/* '
        }
    }, (proxyRes) => {
        // Optionnel : Gérer les redirections si nécessaire (simplifié ici)
        res.setHeader('Content-Type', 'video/MP2T');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Permet au navigateur de lire le flux
        // Pipeline de téléchargement en continu
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error("Proxy error:", err.message);
        res.status(500).send("Chunk proxy failed");
    });
  });

  // Configuration du Middleware Vite pour React (Développement et Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur Live HLS Proxy démarré sur http://localhost:${PORT}`);
  });
}

startServer();
