/**
 * TITAN V35.0 - THE FINAL MONOLITH ENGINE
 * Author: Titan AI
 * Build: Production Stable
 */

const SYSTEM = {
    KEYS: {
        TMDB: '463dcd7993ab31d92eb586802fdeee6a',
        OMDB: '85eb6482'
    },
    ENDPOINTS: {
        STREAM: 'https://u-1-1azw.onrender.com/api/get-stream',
        SUB: 'https://sub.wyzie.ru/search',
        PROXY: (u) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(u)}`
    },
    STATE: {
        active: false,
        id: null,
        type: null,
        s: 1,
        e: 1,
        title: null,
        year: null
    },
    INSTANCES: {
        player: null,
        hls: null
    }
};

// --- 1. INITIALIZATION & ROUTING ---

window.addEventListener('DOMContentLoaded', () => {
    // Determine if we are inside an iframe (The dashboard preview mode)
    const isIframe = window.self !== window.top;
    
    // Parse URL for Deep Links
    const path = window.location.pathname.split('/').filter(Boolean);
    
    // ROUTE: /tv/1399/1/1 or /movie/671
    if (path.length > 0) {
        // If we are deep linked, Hide Dashboard Immediately
        document.getElementById('titan-dashboard').classList.add('hidden');
        
        // If inside iframe, we might want to scale down UI or auto-mute
        if(isIframe) {
            console.log("Titan running in preview mode.");
            // Optional: You could add specific logic here for preview mode
        }

        parseRoute(path);
    } else {
        // We are at Root /, show Dashboard
        console.log("Titan Dashboard Active");
    }
});

function parseRoute(path) {
    // Expected Formats:
    // /movie/123
    // /tv/123/1/1
    // /123/1/1 (Legacy Support)
    
    let type, id, s, e;

    if (path[0] === 'movie') {
        type = 'movie';
        id = path[1];
    } else if (path[0] === 'tv') {
        type = 'tv';
        id = path[1];
        s = path[2];
        e = path[3];
    } else if (!isNaN(path[0])) {
        // Legacy numeric start /1399/1/1 implies TV if 3 args, Movie if 1? 
        // We assume TV if 3 segments, else Movie
        if (path.length >= 3) {
            type = 'tv'; id = path[0]; s = path[1]; e = path[2];
        } else {
            type = 'movie'; id = path[0];
        }
    }

    if (id) {
        SYSTEM.STATE.type = type || 'movie';
        SYSTEM.STATE.id = id;
        SYSTEM.STATE.s = s || 1;
        SYSTEM.STATE.e = e || 1;
        
        initiateSequence();
    }
}

function forceRoute(url) {
    window.history.pushState({}, '', url);
    window.location.reload(); // Hard reload to trigger boot sequence
}

// --- 2. SEARCH ENGINE ---

const searchInput = document.getElementById('search-in');
const searchOutput = document.getElementById('search-out');

searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (query.length < 2) {
        searchOutput.style.display = 'none';
        return;
    }

    try {
        const req = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${SYSTEM.KEYS.TMDB}&query=${query}&page=1`);
        const res = await req.json();
        const data = res.results || [];

        searchOutput.innerHTML = '';
        searchOutput.style.display = 'block';

        data.slice(0, 10).forEach(item => {
            if (item.media_type !== 'movie' && item.media_type !== 'tv') return;

            const row = document.createElement('div');
            row.className = 'res-row';
            
            const poster = item.poster_path 
                ? `https://image.tmdb.org/t/p/w92${item.poster_path}` 
                : 'https://via.placeholder.com/92x138/111/555?text=?';
            
            const title = item.title || item.name;
            const year = (item.release_date || item.first_air_date || 'N/A').split('-')[0];
            const type = item.media_type.toUpperCase();

            row.innerHTML = `
                <img class="res-poster" src="${poster}">
                <div class="res-info">
                    <h4>${title}</h4>
                    <span>${type} • ${year}</span>
                </div>
            `;

            row.onclick = () => {
                if(item.media_type === 'movie') {
                    forceRoute(`/movie/${item.id}`);
                } else {
                    forceRoute(`/tv/${item.id}/1/1`);
                }
            };

            searchOutput.appendChild(row);
        });

    } catch (err) {
        console.error("Search Fail:", err);
    }
}, 300));

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// --- 3. THE MONOLITH LAUNCHER (METADATA + LOGOS) ---

async function initiateSequence() {
    const layer = document.getElementById('loading-layer');
    const backdrop = document.getElementById('load-backdrop');
    const logoImg = document.getElementById('load-logo');
    const status = document.getElementById('load-status');

    layer.style.display = 'flex';
    status.innerText = "AUTHENTICATING METADATA...";

    try {
        // A. Fetch Base Metadata
        const metaUrl = `https://api.themoviedb.org/3/${SYSTEM.STATE.type}/${SYSTEM.STATE.id}?api_key=${SYSTEM.KEYS.TMDB}`;
        const meta = await fetch(metaUrl).then(r => r.json());

        SYSTEM.STATE.title = meta.title || meta.name;
        SYSTEM.STATE.year = (meta.release_date || meta.first_air_date || '').split('-')[0];

        // B. Set Backdrop
        if (meta.backdrop_path) {
            backdrop.src = `https://image.tmdb.org/t/p/original${meta.backdrop_path}`;
        }

        // C. Fetch Images (For Logo)
        status.innerText = "RETRIEVING ASSETS...";
        const imgUrl = `https://api.themoviedb.org/3/${SYSTEM.STATE.type}/${SYSTEM.STATE.id}/images?api_key=${SYSTEM.KEYS.TMDB}`;
        const imgs = await fetch(imgUrl).then(r => r.json());

        // Logic: Find highest rated English PNG logo
        const logo = imgs.logos?.find(l => l.iso_639_1 === 'en' && l.file_path.endsWith('.png')) || imgs.logos?.[0];
        
        if (logo) {
            logoImg.src = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
            logoImg.style.display = 'block';
        } else {
            // Fallback: Use text if no logo
            logoImg.style.display = 'none';
        }

        // D. Calculate Slug & Fetch Streams
        status.innerText = "DENOTING SLUG...";
        await fetchStreams(layer);

    } catch (err) {
        console.error("Sequence Error:", err);
        status.innerText = "METADATA ERROR. RETRYING...";
        setTimeout(() => location.reload(), 3000);
    }
}

async function fetchStreams(layer) {
    const s = SYSTEM.STATE;
    
    // Slug Generation Logic
    // Remove special chars, lowercase, replace spaces with dots
    const cleanTitle = s.title.toLowerCase().replace(/[^a-z0-9]/g, '.');
    let slug;
    
    if (s.type === 'tv') {
        // Format: title.s01e01
        slug = `${cleanTitle}.s${pad(s.s)}e${pad(s.e)}`;
    } else {
        // Format: title.year
        slug = `${cleanTitle}.${s.year}`;
    }

    console.log("Generated Slug:", slug);
    document.getElementById('load-status').innerText = `SEARCHING: ${slug}`;

    // Construct APIs
    // Using the WYSIE Subtitle API and Render Stream API
    const subApi = `${SYSTEM.ENDPOINTS.SUB}?id=${s.id}${s.type==='tv' ? `&season=${s.s}&episode=${s.e}` : ''}`;
    const streamApi = `${SYSTEM.ENDPOINTS.STREAM}?title=${slug}&id=${s.id}&season=${s.s}&episode=${s.e}`;

    try {
        const [subData, streamData] = await Promise.all([
            fetch(SYSTEM.ENDPOINTS.PROXY(subApi)).then(r => r.json()).catch(()=>[]),
            fetch(SYSTEM.ENDPOINTS.PROXY(streamApi)).then(r => r.json()).catch(()=>({}))
        ]);

        if (streamData.m3u8_url) {
            launchPlayer(SYSTEM.ENDPOINTS.PROXY(streamData.m3u8_url), subData);
        } else {
            // 404 on stream
            alert(`TITAN ERROR: Stream not found for slug '${slug}'.`);
            layer.style.display = 'none';
            document.getElementById('titan-dashboard').classList.remove('hidden');
        }

    } catch (err) {
        console.error("Stream Fetch Error:", err);
        alert("Server Connection Failed.");
        layer.style.display = 'none';
    }
}

function pad(n) {
    return String(n).padStart(2, '0');
}

// --- 4. SUPREME PLAYER CONFIGURATION ---

function launchPlayer(url, subs) {
    const terminal = document.getElementById('player-terminal');
    const loading = document.getElementById('loading-layer');

    terminal.style.display = 'block';
    loading.style.display = 'none';

    // Destroy existing instance
    if (SYSTEM.INSTANCES.player) SYSTEM.INSTANCES.player.destroy();

    // Map Subtitles for ArtPlayer
    // Ensure we handle the specific array format from API
    const subConfig = Array.isArray(subs) ? subs.map(s => ({
        html: `<b>${s.lang || s.language || 'Unknown'}</b>`,
        url: SYSTEM.ENDPOINTS.PROXY(s.url),
        name: s.lang || 'Unknown'
    })) : [];

    // Initialize ArtPlayer
    const art = new Artplayer({
        container: '#art-mount',
        url: url,
        type: 'm3u8',
        theme: '#E50914',
        autoplay: true,
        muted: false, // Auto-unmute
        fullscreen: true,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        pip: true,
        lock: true,
        fastForward: true,
        autoOrientation: true,
        
        // Advanced Settings Panel
        settings: [
            {
                html: 'Subtitle Offset',
                width: 250,
                tooltip: '0s',
                selector: [
                    { html: '-5s', value: -5 },
                    { html: '-2s', value: -2 },
                    { html: '-1s', value: -1 },
                    { default: true, html: '0s', value: 0 },
                    { html: '+1s', value: 1 },
                    { html: '+2s', value: 2 },
                    { html: '+5s', value: 5 },
                ],
                onSelect: function (item) {
                    art.subtitleOffset = item.value;
                    return item.html;
                },
            }
        ],

        // Custom HLS Integration
        customType: {
            m3u8: function (video, url) {
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                    SYSTEM.INSTANCES.hls = hls;

                    hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
                        // A. Audio Track Switcher
                        if(hls.audioTracks.length > 0) {
                             art.setting.add({
                                name: 'audio',
                                html: 'Audio Track',
                                tooltip: hls.audioTracks[hls.audioTrack].name || 'Default',
                                selector: hls.audioTracks.map((t, i) => ({
                                    html: t.name || `Track ${i+1}`,
                                    index: i,
                                    default: hls.audioTrack === i
                                })),
                                onSelect: function (item) {
                                    hls.audioTrack = item.index;
                                    return item.html;
                                }
                            });
                        }

                        // B. Quality Switcher
                        if(hls.levels.length > 1) {
                            art.setting.add({
                                name: 'quality',
                                html: 'Quality',
                                tooltip: 'Auto',
                                selector: [
                                    { html: 'Auto', index: -1, default: true },
                                    ...hls.levels.map((l, i) => ({
                                        html: `${l.height}p`,
                                        index: i
                                    }))
                                ],
                                onSelect: function (item) {
                                    hls.currentLevel = item.index;
                                    return item.html;
                                }
                            });
                        }
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                } else {
                    art.notice.show = 'Unsupported Playback Format';
                }
            }
        },
    });

    // --- SUBTITLE LOGIC ---
    // 1. Add Subtitle Switcher to Settings
    if (subConfig.length > 0) {
        art.setting.add({
            name: 'subtitle-source',
            html: 'Subtitles',
            tooltip: 'Off',
            selector: [
                { html: 'Off', url: null, default: true },
                ...subConfig
            ],
            onSelect: function (item) {
                if(item.url) {
                    art.subtitle.url = item.url;
                    art.subtitle.show = true;
                    // We use manual rendering, so we might want to hide default?
                    // ArtPlayer default subtitle is decent, but user asked for custom DIV.
                    // We will hook the subtitleUpdate event.
                } else {
                    art.subtitle.show = false;
                    updateManualSubtitle('');
                }
                return item.html;
            }
        });
    }

    // 2. Manual Subtitle Renderer Hook
    art.on('subtitleUpdate', (text) => {
        updateManualSubtitle(text);
    });

    SYSTEM.INSTANCES.player = art;
}

// Helper for the specific div requirement
function updateManualSubtitle(text) {
    const el = document.getElementById('titan-subtitle-render');
    if (text && text.trim() !== '') {
        el.innerHTML = text;
        el.style.display = 'inline-block';
    } else {
        el.style.display = 'none';
    }
}

function systemReboot() {
    // Kill Player
    if (SYSTEM.INSTANCES.player) SYSTEM.INSTANCES.player.destroy();
    if (SYSTEM.INSTANCES.hls) SYSTEM.INSTANCES.hls.destroy();

    // Reset UI
    document.getElementById('player-terminal').style.display = 'none';
    document.getElementById('titan-dashboard').classList.remove('hidden');

    // Clean URL
    window.history.pushState({}, '', '/');
    
    // Reset Internal State
    SYSTEM.STATE.id = null;
}
