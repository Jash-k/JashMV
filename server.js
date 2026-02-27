import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import iptvPlaylistParser from 'iptv-playlist-parser';
const parse = iptvPlaylistParser.parse || iptvPlaylistParser;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));

// Keep-alive mechanism for free tier services (like Render)
app.get('/ping', (req, res) => res.send('pong'));

const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes (Render sleeps after 15)
setInterval(() => {
    axios.get(`http://localhost:${PORT}/ping`).catch(() => {});
}, KEEP_ALIVE_INTERVAL);


// --- HELPERS ---

const decodeConfig = (configStr) => {
  try {
    return JSON.parse(Buffer.from(configStr, 'base64').toString('utf-8'));
  } catch (e) {
    console.error("Config Decode Error:", e.message);
    return null;
  }
};

// In-memory cache: Key = JSON.stringify(sources), Value = { data: movies[], timestamp: number }
const playlistCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache for playlist fetching

// TMDB Cache to avoid hitting rate limits too hard
const tmdbCache = new Map();

const normalizeTitle = (str) => {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
};

const extractYear = (title) => {
    const match = title.match(/\((\d{4})\)/);
    return match ? match[1] : '';
};

const cleanTitleName = (title) => {
    return title.replace(/\(\d{4}\)/, '')
                .replace(/\(.*\)/, '') // Remove other parenthesis info
                .trim();
};

const getQuality = (title) => {
    const lower = title.toLowerCase();
    if (lower.includes('4k') || lower.includes('2160p')) return '4K';
    if (lower.includes('1080p')) return '1080p';
    if (lower.includes('720p')) return '720p';
    if (lower.includes('480p')) return 'SD';
    return 'Unknown';
};

// Fetch and Merge Logic
const getMoviesFromSources = async (sources) => {
    const cacheKey = JSON.stringify(sources);
    const now = Date.now();

    if (playlistCache.has(cacheKey)) {
        const { data, timestamp } = playlistCache.get(cacheKey);
        if (now - timestamp < CACHE_TTL) {
            return data;
        }
    }

    console.log(`Fetching ${sources.length} playlists...`);

    const movieMap = new Map(); // Key: "Title|Year" -> Movie Object

    const fetchPromises = sources.map(async (source) => {
        try {
            const response = await axios.get(source.url);
            const playlist = parse(response.data);
            
            playlist.items.forEach(item => {
                // Determine Title and Year
                // Priority: tvg-name -> name
                const rawTitle = item.tvg.name || item.name;
                const year = extractYear(rawTitle);
                const title = cleanTitleName(rawTitle);
                const originalTitleWithYear = year ? `${title} (${year})` : title;

                // Unique Key for Grouping
                // If we have a year, use it to distinguish remakes.
                const key = year ? `${normalizeTitle(title)}|${year}` : normalizeTitle(title);

                // Stream Info
                const quality = getQuality(rawTitle);
                const streamEntry = {
                    title: `${quality} - ${source.name || 'Source'} \n${item.group.title || ''}`,
                    url: item.url,
                    name: source.name || 'M3U',
                    behaviorHints: {
                        notWebReady: true // Hints that this might not play in browser
                    }
                };

                if (movieMap.has(key)) {
                    // Add stream to existing movie
                    movieMap.get(key).streams.push(streamEntry);
                } else {
                    // Create new movie entry
                    // We use a deterministic ID based on the key to ensure it stays same across reloads
                    const id = 'm3u_' + Buffer.from(key).toString('hex');
                    
                    movieMap.set(key, {
                        id: id,
                        type: 'movie',
                        name: originalTitleWithYear, // Display name
                        cleanName: title, // For TMDB search
                        poster: item.tvg.logo,
                        background: item.tvg.logo,
                        year: year,
                        genres: item.group.title ? [item.group.title] : [],
                        streams: [streamEntry],
                        description: `Available in ${quality}`
                    });
                }
            });

        } catch (error) {
            console.error(`Error fetching source ${source.name} (${source.url}):`, error.message);
        }
    });

    await Promise.all(fetchPromises);

    const movies = Array.from(movieMap.values());
    playlistCache.set(cacheKey, { data: movies, timestamp: now });
    console.log(`Parsed ${movies.length} unique movies from sources.`);
    return movies;
};


// TMDB Integration
const fetchTMDBMetadata = async (movie, apiKey) => {
    if (!apiKey) return movie;

    const cacheKey = `tmdb_${movie.id}`;
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);

    try {
        // Search
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movie.cleanName)}&year=${movie.year}`;
        const searchRes = await axios.get(searchUrl);
        
        if (searchRes.data.results && searchRes.data.results.length > 0) {
            const tmdbItem = searchRes.data.results[0];
            
            // Get full details (for genres, runtime, etc if needed, but search result has most)
            // We'll stick to search result for speed unless we need more
            
            const meta = {
                ...movie,
                name: tmdbItem.title,
                poster: tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : movie.poster,
                background: tmdbItem.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbItem.backdrop_path}` : movie.background,
                description: tmdbItem.overview || movie.description,
                year: tmdbItem.release_date ? tmdbItem.release_date.split('-')[0] : movie.year,
                releaseInfo: tmdbItem.release_date ? tmdbItem.release_date.split('-')[0] : movie.year,
                imdbRating: tmdbItem.vote_average.toFixed(1),
                genres: tmdbItem.genre_ids ? [] : movie.genres // We'd need genre map for IDs, skip for now or fetch full details
            };
            
            tmdbCache.set(cacheKey, meta);
            return meta;
        }
    } catch (e) {
        console.error("TMDB Error:", e.message);
    }

    return movie;
};


// --- ROUTES ---

app.get('/manifest.json', (req, res) => {
    res.status(400).send("Configuration required. Please visit the addon settings page.");
});

app.get('/:config/manifest.json', (req, res) => {
    const config = decodeConfig(req.params.config);
    if (!config) return res.status(400).send("Invalid Config");

    const manifest = {
        id: 'community.m3uaddon.multi',
        version: '1.1.0',
        name: 'M3U Multi-Source',
        description: 'Stream movies from multiple M3U playlists with Auto-Refresh and TMDB.',
        resources: ['catalog', 'stream', 'meta'],
        types: ['movie'],
        catalogs: [
            {
                type: 'movie',
                id: 'm3u_movies',
                name: 'M3U Movies',
                extra: [
                    { name: 'search', isRequired: false },
                    { name: 'genre', isRequired: false },
                    { name: 'skip', isRequired: false } // For pagination if we wanted
                ]
            }
        ],
        idPrefixes: ['m3u_']
    };
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(manifest);
});

const handleCatalog = async (req, res) => {
    const { config: configStr, type, extra } = req.params;
    
    if (type !== 'movie') return res.json({ metas: [] });

    const config = decodeConfig(configStr);
    if (!config || !config.sources) return res.json({ metas: [] });

    let movies = await getMoviesFromSources(config.sources);

    // Parse Extra
    let search = null;
    let genre = null;
    
    if (extra) {
        // Stremio passes extra as "key=value&key2=value2"
        const parts = extra.split('&');
        parts.forEach(p => {
            const [key, val] = p.split('=');
            if (key === 'search') search = decodeURIComponent(val);
            if (key === 'genre') genre = decodeURIComponent(val);
        });
    }

    // Filter
    let results = movies;
    if (search) {
        results = results.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (genre) {
        results = results.filter(m => m.genres && m.genres.includes(genre));
    }
    
    // Sort by year desc
    results.sort((a, b) => (b.year || 0) - (a.year || 0));

    // Pagination Limit
    if (!search && results.length > 100) {
        results = results.slice(0, 100);
    }

    const metas = results.map(m => ({
        id: m.id,
        type: 'movie',
        name: m.name,
        poster: m.poster,
        releaseInfo: m.year
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ metas });
};

app.get('/:config/catalog/:type/:id.json', async (req, res) => {
    await handleCatalog(req, res);
});

app.get('/:config/catalog/:type/:id/:extra.json', async (req, res) => {
    await handleCatalog(req, res);
});

app.get('/:config/meta/:type/:id.json', async (req, res) => {
    const { config: configStr, id } = req.params;
    const config = decodeConfig(configStr);
    
    if (!config) return res.json({ meta: {} });

    let movies = await getMoviesFromSources(config.sources);
    let movie = movies.find(m => m.id === id);

    if (!movie) return res.json({ meta: {} });

    // Enrich with TMDB on demand for the specific item
    const enrichedMovie = await fetchTMDBMetadata(movie, config.tmdbKey);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ meta: enrichedMovie });
});

app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const { config: configStr, id } = req.params;
    const config = decodeConfig(configStr);

    if (!config) return res.json({ streams: [] });

    let movies = await getMoviesFromSources(config.sources);
    let movie = movies.find(m => m.id === id);

    if (!movie) return res.json({ streams: [] });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ streams: movie.streams });
});

// Fallback
app.get('*', (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
