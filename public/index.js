/**
 * TITAN OMNI SYSTEM CORE V36.0
 * ARCHITECT: TITAN AI
 * STATUS: STABLE
 */

const CONFIG = {
    KEYS: { TMDB: '463dcd7993ab31d92eb586802fdeee6a' },
    URLS: {
        PROXY: (url) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(url)}`,
        STREAM: 'https://u-1-1azw.onrender.com/api/get-stream',
        SUB: 'https://sub.wyzie.ru/search'
    },
    SYSTEM: {
        player: null,
        hls: null,
        isPreview: window.self !== window.top // Detects if running inside Dashboard iframe
    }
};

// --- 1. BOOT SEQUENCE ---

window.addEventListener('DOMContentLoaded', () => {
    // A. Preview Mode Check
    if (CONFIG.SYSTEM.isPreview) {
        document.body.classList.add('preview-mode');
        console.log("TITAN: Running in Preview Portal Mode");
    }

    // B. URL Parsing
    const segments = window.location.pathname.split('/').filter(Boolean);
    
    if (segments.length > 0) {
        // We have a deep link (/1399/1/1)
        if (!CONFIG.SYSTEM.isPreview) {
            document.getElementById('titan-dashboard').classList.add('offline');
        }
        initiatePathfinder(segments);
    } else {
        // We are on Home Screen
        if (CONFIG.SYSTEM.isPreview) {
            // If home screen is loaded in iframe, redirect to a default show (prevents loop)
            window.location.href = '/tv/1399/1/1'; 
        }
    }
});

function commandLaunch(path) {
    // Used by Dashboard cards to launch full screen
    window.history.pushState({}, '', path);
    window.location.reload();
}

// --- 2. SEARCH PROTOCOL ---

const sInput = document.getElementById('search-input');
const sDrop = document.getElementById('search-dropdown');

sInput.addEventListener('input', async (e) => {
    const q = e.target.value;
    if (q.length < 2) { sDrop.classList.remove('active'); return; }

    const url = `https://api.themoviedb.org/3/search/multi?api_key=${CONFIG.KEYS.TMDB}&query=${q}`;
    const res = await fetch(url).then(r => r.json());
    
    sDrop.innerHTML = '';
    sDrop.classList.add('active');

    (res.results || []).slice(0, 8).forEach(item => {
        if (!['movie', 'tv'].includes(item.media_type)) return;
        
        const div = document.createElement('div');
        div.className = 'result-row';
        div.innerHTML = `
            <img class="result-poster" src="https://image.tmdb.org/t/p/w92${item.poster_path || ''}">
            <div class="result-meta">
                <h4>${item.title || item.name}</h4>
                <span>${item.media_type} • ${(item.release_date || item.first_air_date || 'N/A').split('-')[0]}</span>
            </div>
        `;
        div.onclick = () => commandLaunch(item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}/1/1`);
        sDrop.appendChild(div);
    });
});

// --- 3. PATHFINDER ENGINE ---

async function initiatePathfinder(segments) {
    const loader = document.getElementById('titan-loader');
    const status = document.getElementById('load-text');
    
    // Only show loader if NOT in preview mode (to keep dashboard clean)
    if (!CONFIG.SYSTEM.isPreview) loader.style.display = 'flex';

    try {
        let id, type, s = 1, e = 1;

        // Parse Segments
        if (segments[0] === 'movie') {
            type = 'movie'; id = segments[1];
        } else if (segments[0] === 'tv') {
            type = 'tv'; id = segments[1]; s = segments[2]; e = segments[3];
        } else {
            // Legacy /1399/1/1
            if (segments.length >= 3) { type = 'tv'; id = segments[0]; s = segments[1]; e = segments[2]; }
            else { type = 'movie'; id = segments[0]; }
        }

        // 1. Fetch Metadata
        status.innerText = "ACQUIRING METADATA...";
        const meta = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${CONFIG.KEYS.TMDB}`).then(r => r.json());
        const images = await fetch(`https://api.themoviedb.org/3/${type}/${id}/images?api_key=${CONFIG.KEYS.TMDB}`).then(r => r.json());

        // Update UI
        const title = meta.title || meta.name;
        const year = (meta.release_date || meta.first_air_date || '').split('-')[0];
        const logo = images.logos?.find(l => l.iso_639_1 === 'en' && l.file_path.endsWith('.png'))?.file_path || images.logos?.[0]?.file_path;

        if (logo) document.getElementById('load-logo').src = `https://image.tmdb.org/t/p/w500${logo}`;
        if (meta.backdrop_path) document.getElementById('load-backdrop').src = `https://image.tmdb.org/t/p/original${meta.backdrop_path}`;

        // 2. Generate Slug
        status.innerText = "CALCULATING STREAM ROUTE...";
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '.');
        const slug = type === 'tv' 
            ? `${cleanTitle}.s${String(s).padStart(2,'0')}e${String(e).padStart(2,'0')}`
            : `${cleanTitle}.${year}`;

        // 3. Fetch Stream
        const streamUrl = `${CONFIG.URLS.STREAM}?title=${slug}&id=${id}&season=${s}&episode=${e}`;
        const subUrl = `${CONFIG.URLS.SUB}?id=${id}${type==='tv' ? `&season=${s}&episode=${e}` : ''}`;

        const [streamData, subData] = await Promise.all([
            fetch(CONFIG.URLS.PROXY(streamUrl)).then(r => r.json()).catch(() => ({})),
            fetch(CONFIG.URLS.PROXY(subUrl)).then(r => r.json()).catch(() => [])
        ]);

        if (streamData.m3u8_url) {
            deployPlayer(CONFIG.URLS.PROXY(streamData.m3u8_url), subData);
        } else {
            throw new Error(`Stream Mesh Failed for: ${slug}`);
        }

    } catch (err) {
        console.error("TITAN FATAL ERROR:", err);
        if (!CONFIG.SYSTEM.isPreview) {
            status.innerText = "STREAM NOT FOUND.";
            status.style.color = "red";
            setTimeout(() => {
                loader.style.display = 'none';
                document.getElementById('titan-dashboard').classList.remove('offline');
            }, 2000);
        }
    }
}

// --- 4. PLAYER DEPLOYMENT ---

function deployPlayer(m3u8, subs) {
    document.getElementById('titan-loader').style.display = 'none';
    document.getElementById('titan-terminal').style.display = 'block';

    if (CONFIG.SYSTEM.player) CONFIG.SYSTEM.player.destroy();

    // Map Subtitles
    const subList = Array.isArray(subs) ? subs.map(s => ({
        html: s.lang || s.language || 'Unknown',
        url: CONFIG.URLS.PROXY(s.url),
    })) : [];

    const art = new Artplayer({
        container: '#art-container',
        url: m3u8,
        type: 'm3u8',
        theme: '#E50914',
        autoplay: true,
        muted: CONFIG.SYSTEM.isPreview, // Mute if in dashboard preview
        fullscreen: !CONFIG.SYSTEM.isPreview, // Fullscreen only if main window
        fullscreenWeb: true,
        autoSize: true,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        pip: true,
        
        // Manual Subtitle Control
        settings: [
            {
                html: 'Subtitle Delay',
                selector: [-5, -2, -1, 0, 1, 2, 5].map(v => ({ html: v+'s', value: v, default: v===0 })),
                onSelect: (item) => { art.subtitleOffset = item.value; return item.html; }
            }
        ],

        customType: {
            m3u8: function(video, url) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                CONFIG.SYSTEM.hls = hls;
                
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (!CONFIG.SYSTEM.isPreview) {
                        // Only add complex controls if NOT in preview
                        art.setting.add({
                            name: 'audio', html: 'Audio Track',
                            selector: hls.audioTracks.map((t, i) => ({ html: t.name || `Track ${i+1}`, index: i })),
                            onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                        });
                        art.setting.add({
                            name: 'quality', html: 'Quality',
                            selector: hls.levels.map((l, i) => ({ html: `${l.height}p`, index: i })),
                            onSelect: (item) => { hls.currentLevel = item.index; return item.html; }
                        });
                        art.setting.add({
                            name: 'subs', html: 'Subtitles',
                            selector: [{html: 'Off', url: ''}, ...subList],
                            onSelect: (item) => {
                                if(item.url) { 
                                    art.subtitle.url = item.url; 
                                    art.subtitle.show = true; 
                                } else { 
                                    art.subtitle.show = false; 
                                    updateManualSub(''); 
                                }
                                return item.html;
                            }
                        });
                    }
                });
            }
        }
    });

    // Manual Subtitle Injection Hook
    art.on('subtitleUpdate', (text) => {
        updateManualSub(text);
    });

    CONFIG.SYSTEM.player = art;
}

function updateManualSub(text) {
    const el = document.getElementById('titan-sub-render');
    if (text && text.trim() !== '') {
        el.innerHTML = text;
        el.style.display = 'inline-block';
    } else {
        el.style.display = 'none';
    }
}

function terminateSession() {
    if (CONFIG.SYSTEM.player) CONFIG.SYSTEM.player.destroy();
    if (CONFIG.SYSTEM.hls) CONFIG.SYSTEM.hls.destroy();
    
    document.getElementById('titan-terminal').style.display = 'none';
    document.getElementById('titan-dashboard').classList.remove('offline');
    window.history.pushState({}, '', '/');
}
