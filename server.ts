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

    // Headers cruciaux pour le streaming vidéo en direct et le contournement des proxies
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // TRÈS IMPORTANT: Désactive la mise en mémoire tampon des reverse-proxies (Nginx, etc.)
    // C'est ce qui causait le "chargement infini qui tourne en rond" !
    res.setHeader('X-Accel-Buffering', 'no');

    let isClientConnected = true;

    req.on('close', () => {
        isClientConnected = false;
        console.log('[Serveur] Lecteur Web déconnecté.');
    });

    console.log('[Serveur] Démarrage de la boucle de flux ininterrompue pour:', targetUrl);

    async function streamLoop() {
        while (isClientConnected) {
            try {
                // On imite un lecteur VLC pour passer les blocages IPTV
                const response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
                        'Accept': '*/*',
                        'Connection': 'keep-alive'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
                
                if (!response.body) throw new Error("Body vide");

                const reader = response.body.getReader();

                while (isClientConnected) {
                    const { done, value } = await reader.read();
                    if (done) break; // Le fournisseur IPTV a coupé ! On sort de la boucle interne
                    res.write(value); // Envoi direct au navigateur sans attendre
                }
                
                if (isClientConnected) {
                    console.log('[Serveur] Coupure IPTV repérée. Reconnexion immédiate (Lissage)...');
                }
                
            } catch (err: any) {
                if (isClientConnected) {
                    console.error('[Serveur] Erreur de lecture HTTP:', err.message);
                    // Petite pause en cas d'erreur réseau avant de re-tenter la connexion
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
        res.end(); // On ferme proprement si le client quitte la page
    }

    streamLoop();
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
