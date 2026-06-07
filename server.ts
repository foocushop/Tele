import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Provide absolute path to ffmpeg binary
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Store active ffmpeg processes to kill them gracefully when users stop watching
const activeStreams = new Map<string, {
    process: ffmpeg.FfmpegCommand,
    timeout: NodeJS.Timeout
}>();

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

  // ========== FLUX HLS ROBUSTE VIA FFMPEG (SUPPRIME LES ROLLBACKS) ==========
  app.get('/api/proxy/live.m3u8', (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("No url provided");

    const streamId = crypto.createHash('md5').update(targetUrl).digest('hex');
    const hlsDir = path.join('/tmp', 'hls', streamId);
    const m3u8Path = path.join(hlsDir, 'stream.m3u8');

    // Create the directory if it doesn't exist
    if (!fs.existsSync(hlsDir)) {
        fs.mkdirSync(hlsDir, { recursive: true });
    }

    // Function to kill stream on inactivity
    const resetTimeout = () => {
        if (activeStreams.has(streamId)) {
            const streamParam = activeStreams.get(streamId)!;
            clearTimeout(streamParam.timeout);
            streamParam.timeout = setTimeout(() => {
                console.log(`[FFMPEG] Arrêt du stream inactif : ${streamId}`);
                streamParam.process.kill('SIGKILL');
                activeStreams.delete(streamId);
                // Cleanup files
                fs.rmSync(hlsDir, { recursive: true, force: true });
            }, 30000); // 30 seconds of inactivity -> stop process
        }
    };

    if (!activeStreams.has(streamId)) {
        console.log(`[FFMPEG] Démarrage du transcodage HLS en direct pour : ${streamId}`);
        // We ensure any old files are deleted so we don't serve dead segments
        fs.rmSync(hlsDir, { recursive: true, force: true });
        fs.mkdirSync(hlsDir, { recursive: true });

        const command = ffmpeg()
            .input(targetUrl)
            // Options pour rendre la lecture HTTP très résiliente aux coupures du fournisseur
            .inputOptions([
                '-reconnect 1',
                '-reconnect_at_eof 1', 
                '-reconnect_streamed 1',
                '-reconnect_delay_max 5',
                '-y' // overwrite
            ])
            .outputOptions([
                '-c copy',                     // On ne re-encode pas (économise CPU massivement)
                '-f hls',                      // Format de sortie Apple HLS
                '-hls_time 4',                 // Segments de 4 secondes (faible latence)
                '-hls_list_size 5',            // Playlist de taille 5
                '-hls_flags delete_segments+append_list+omit_endlist', // Rotation propre des segments
                '-hls_segment_type mpegts',    // Force .ts output
                `-hls_base_url /api/proxy/${streamId}/` // Chemin absolu pour les segments
            ])
            .output(m3u8Path)
            .on('error', (err) => {
                console.error(`[FFMPEG] Erreur: ${err.message}`);
                activeStreams.delete(streamId);
            });

        command.run();

        activeStreams.set(streamId, {
            process: command,
            // Timeout that will be reset on every m3u8 poll
            timeout: setTimeout(() => {}, 0) 
        });
        resetTimeout();

        // On patiente quelques secondes que FFMPEG écrive le premier segment
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            if (fs.existsSync(m3u8Path)) {
                clearInterval(checkInterval);
                res.sendFile(m3u8Path);
            } else {
                checkCount++;
                if (checkCount > 40) { // Timeout after 10 seconds
                    clearInterval(checkInterval);
                    res.status(500).send("FFmpeg failed to start stream quickly enough.");
                }
            }
        }, 250);
        return;
    }

    // FFMPEG process is active, just reset timeout and serve the latest playlist
    resetTimeout();
    
    if (fs.existsSync(m3u8Path)) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(m3u8Path);
    } else {
        res.status(404).send("Playlist not ready yet.");
    }
  });

  // ========== FOURNISSEUR STATIQUE POUR LES SEGMENTS .TS ==========
  app.get('/api/proxy/:streamId/:segmentFile', (req, res) => {
      const { streamId, segmentFile } = req.params;
      const filePath = path.join('/tmp', 'hls', streamId, segmentFile);
      if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'video/MP2T');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.sendFile(filePath);
      } else {
          res.status(404).end();
      }
  });

  // Proxy TS Seamless (Pont Transparent) - Gardé pour la compatibilité
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
