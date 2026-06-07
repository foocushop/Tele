import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    if (req.method === 'OPTIONS') {
         res.sendStatus(200);
         return;
    }
    next();
  });

  // Proxy TS Seamless (Pont Transparent)
  app.get('/api/proxy/stream.ts', (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("Veuillez fournir une URL source.");

    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Accel-Buffering', 'no');

    let isClientConnected = true;
    const abortController = new AbortController();

    req.on('close', () => {
        isClientConnected = false;
        abortController.abort(); // IMPORTANT! Cancel the fetch.
        console.log('[Serveur] Lecteur Web déconnecté.');
    });

    console.log('[Serveur] Démarrage de la boucle de flux ininterrompue pour:', targetUrl);

    async function streamLoop() {
        while (isClientConnected) {
            try {
                const response = await fetch(targetUrl, {
                    signal: abortController.signal,
                    headers: {
                        'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
                        'Accept': '*/*'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
                if (!response.body) throw new Error("Body vide");

                const reader = response.body.getReader();

                while (isClientConnected) {
                    const { done, value } = await reader.read();
                    if (done) break; 
                    res.write(value); 
                }
                
                if (isClientConnected) {
                    console.log('[Serveur] Coupure IPTV repérée. Reconnexion immédiate (Lissage)...');
                }
                
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    console.log('[Serveur] Connexion annulée proprement.');
                    break;
                }
                if (isClientConnected) {
                    console.error('[Serveur] Erreur de lecture HTTP:', err.message);
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }
        res.end();
    }

    streamLoop();
  });

  // Flux HLS Dynamique (M3U8) avec gestion de la discontinuité
  let globalEpochSequence = Math.floor(Date.now() / 20000);
  
  app.get('/api/proxy/playlist.m3u8', (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("No url provided");
    
    // Déclare un flux en direct (Fenêtre glissante de 3 segments de 20s)
    const segmentDuration = 20; // 20 secondes, temps moyen d'une coupure iptv
    const currentSeq = Math.floor(Date.now() / 1000 / segmentDuration);
    
    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:3\n";
    m3u8 += `#EXT-X-TARGETDURATION:${segmentDuration}\n`;
    m3u8 += `#EXT-X-MEDIA-SEQUENCE:${currentSeq - 2}\n`; // 3 segments dans le passé
    
    // Segment le plus ancien
    m3u8 += "#EXT-X-DISCONTINUITY\n";
    m3u8 += `#EXTINF:${segmentDuration}.000,\n`;
    m3u8 += `/api/proxy/segment.ts?url=${encodeURIComponent(targetUrl)}&seq=${currentSeq - 2}\n`;
    
    // Segment du milieu
    m3u8 += "#EXT-X-DISCONTINUITY\n";
    m3u8 += `#EXTINF:${segmentDuration}.000,\n`;
    m3u8 += `/api/proxy/segment.ts?url=${encodeURIComponent(targetUrl)}&seq=${currentSeq - 1}\n`;
    
    // Segment le plus récent
    m3u8 += "#EXT-X-DISCONTINUITY\n";
    m3u8 += `#EXTINF:${segmentDuration}.000,\n`;
    m3u8 += `/api/proxy/segment.ts?url=${encodeURIComponent(targetUrl)}&seq=${currentSeq}\n`;
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(m3u8);
  });

  // Gestion des mini-segments TS pour HLS.js
  const activeSegments = new Map<string, Date>(); // Pour éviter l'abus de requêtes
  
  app.get('/api/proxy/segment.ts', async (req, res) => {
      const targetUrl = req.query.url as string;
      const seq = req.query.seq as string;
      if (!targetUrl) return res.status(400).send("No url");

      res.setHeader('Content-Type', 'video/MP2T');
      res.setHeader('Connection', 'close'); // On coupe à la fin du segment
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Accel-Buffering', 'no');

      const abortController = new AbortController();
      req.on('close', () => abortController.abort());

      try {
          const response = await fetch(targetUrl, {
              signal: abortController.signal,
              headers: {
                  'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
                  'Accept': '*/*'
              }
          });

          if (!response.ok) return res.status(500).end();
          if (!response.body) return res.status(500).end();

          const reader = response.body.getReader();
          let startTime = Date.now();
          
          while (true) {
              // Si 20 secondes se sont écoulées, on coupe pour simuler la fin du segment
              if (Date.now() - startTime > 20000) {
                  break; 
              }
              const { done, value } = await reader.read();
              if (done) break; // Le fournisseur a coupé plus tôt que prévu
              res.write(value);
          }
          res.end();
      } catch (err: any) {
          res.end();
      }
  });

  // Setup Vite Middleware React
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
    console.log(`Le serveur proxy IPTV est en ligne sur le port ${PORT}`);
  });
}

startServer();
