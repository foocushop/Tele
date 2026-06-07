import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configuration CORS robuste pour le lecteur vidéo web
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    if (req.method === 'OPTIONS') {
         res.sendStatus(200);
         return;
    }
    next();
  });

  // Endpoint API : TS Proxy Anti-Coupure (Seamless Reconnect)
  // Ce pont se connecte au serveur IPTV. Si le serveur IPTV coupe (toutes les 20s),
  // ce pont se reconnecte en arrière-plan SANS fermer la connexion vers VLC ou le client web.
  app.get('/api/proxy/stream.ts', (req, res) => {
    let targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("No url provided");

    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let isClientConnected = true;
    req.on('close', () => {
        console.log('[Pont Serveur] Client ou lecteur déconnecté.');
        isClientConnected = false;
    });

    console.log('[Pont Serveur] Démarrage du flux ininterrompu pour:', targetUrl);

    async function connectStream() {
        if (!isClientConnected) return;
        
        try {
            // L'utilisation de fetch natif gère automatiquement les redirections (très courant en IPTV)
            const proxyRes = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
                    'Accept': '*/*',
                    'Connection': 'keep-alive'
                }
            });

            if (!proxyRes.ok) {
                throw new Error(`HTTP Error: ${proxyRes.status} ${proxyRes.statusText}`);
            }

            if (!proxyRes.body) {
                throw new Error('No body received');
            }

            // Récupère le flux de données en continu
            const reader = proxyRes.body.getReader();

            while (isClientConnected) {
                const { done, value } = await reader.read();
                
                if (done) {
                    // MAGIE ICI : Le flux s'est arrêté (probablement la coupure des 20s).
                    // On sort de la boucle et on relance la fonction SANS fermer res.
                    break;
                }

                // Envoie des données concaténées au lecteur vidéo
                res.write(value);
            }

            if (isClientConnected) {
                console.log('[Pont Serveur] Fin d\'un segment (coupure IPTV). Reconnexion transparente...');
                connectStream(); // Reconnexion immédiate
            }

        } catch (err: any) {
            if (isClientConnected) {
                console.error('[Pont Serveur] Erreur réseau:', err.message);
                // En cas d'erreur de réseau temporaire, on patiente une seconde et on réessaie
                setTimeout(connectStream, 1000);
            }
        }
    }

    connectStream();
  });

  // Alias M3U8 si certains lecteurs exigent formellement le format playlist.
  // Elle pointe vers le stream proxy ininterrompu.
  app.get('/api/proxy/playlist.m3u8', (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("No url provided");
    
    const encodedUrl = encodeURIComponent(targetUrl);
    const host = req.headers.host || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const proxyTsUrl = `${proto}://${host}/api/proxy/stream.ts?url=${encodedUrl}`;

    let m3u8 = "#EXTM3U\n";
    m3u8 += "#EXT-X-VERSION:3\n";
    // Durée virtuellement infinie
    m3u8 += "#EXT-X-TARGETDURATION:86400\n"; 
    m3u8 += "#EXT-X-ALLOW-CACHE:YES\n";
    m3u8 += "#EXTINF:86400.0,\n";
    m3u8 += `${proxyTsUrl}\n`;

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.send(m3u8);
  });

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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
