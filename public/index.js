/**
 * TITAN V32.0 - SUPREME PATHFINDER CORE
 */

const CONFIG = {
    TMDB_KEY: '463dcd7993ab31d92eb586802fdeee6a',
    PROXY: (u) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(u)}`,
    PLAYER: null,
    HLS: null
};

// --- INITIAL URL SCANNER ---
window.onload = function() {
    const path = window.location.pathname.split('/').filter(Boolean);
    if (path.length > 0) {
        document.getElementById('titan-dashboard').classList.add('db-hidden');
        processPath(path);
    }
};

async function processPath(path) {
    let id, s, e, type;

    if (path[0] === 'movie') {
        type = 'movie'; id = path[1];
    } else {
        id = path[0]; s = path[1]; e = path[2];
        type = s ? 'tv' : 'movie';
    }

    if (id) runSupremeEngine(id, type, s, e);
}

// --- MASTER ENGINE ---
async function runSupremeEngine(id, type, s, e) {
    const lyr = document.getElementById('loading-lyr');
    lyr.style.display = 'flex';

    try {
        // 1. Fetch High-Fidelity Official Title Logo
        const images = await fetch(`https://api.themoviedb.org/3/${type}/${id}/images?api_key=${CONFIG.TMDB_KEY}`).then(r => r.json());
        const details = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${CONFIG.TMDB_KEY}`).then(r => r.json());
        
        // Find English Transparent Logo
        const logo = images.logos?.find(l => l.iso_639_1 === 'en' && l.file_path.endsWith('.png')) || images.logos?.[0];
        if (logo) {
            document.getElementById('exclusive-logo').src = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        } else {
            // Fallback to text logo if no PNG found
            document.getElementById('exclusive-logo').style.display = 'none';
        }

        const title = details.title || details.name;
        const year = (details.release_date || details.first_air_date || '').split('-')[0];

        // 2. Generate Denoted Slug
        let slug;
        if (type === 'tv') {
            slug = `${title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.s${String(s).padStart(2,'0')}e${String(e).padStart(2,'0')}`;
        } else {
            slug = `${title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.${year}`;
        }

        // 3. Fetch Subs & Stream
        const subApi = `https://sub.wyzie.ru/search?id=${id}${type === 'tv' ? `&season=${s}&episode=${e}` : ''}`;
        const streamApi = `https://u-1-1azw.onrender.com/api/get-stream?title=${slug}&id=${id}&season=${s}&episode=${e}`;

        const [subs, stream] = await Promise.all([
            fetch(CONFIG.PROXY(subApi)).then(r => r.json()),
            fetch(CONFIG.PROXY(streamApi)).then(r => r.json())
        ]);

        if (stream.m3u8_url) {
            launchArt(CONFIG.PROXY(stream.m3u8_url), subs);
        } else {
            alert("No stream found for slug: " + slug);
            lyr.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
        lyr.style.display = 'none';
    }
}

// --- SUPREME ARTPLAYER ---
function launchArt(m3u8, subs) {
    document.getElementById('player-shell').style.display = 'block';
    document.getElementById('loading-lyr').style.display = 'none';

    if (CONFIG.PLAYER) CONFIG.PLAYER.destroy();

    CONFIG.PLAYER = new Artplayer({
        container: '#art-mount',
        url: m3u8,
        type: 'm3u8',
        autoplay: true,
        fullscreen: true,
        setting: true,
        theme: '#E50914',
        aspectRatio: true,
        playbackRate: true,
        settings: [
            {
                html: 'Subtitle Delay',
                selector: [-5, -2, -1, 0, 1, 2, 5].map(v => ({ html: v + 's', value: v, default: v === 0 })),
                onSelect: (v) => { CONFIG.PLAYER.subtitleOffset = v.value; return v.html; }
            }
        ],
        layers: [{
            name: 'sub-layer',
            html: `<div class="SubtitleVideoCaption_mobileSubtitleContainer__vo_7_"><p id="titan-sub-p"></p></div>`
        }, {
            name: 'nf-controls',
            html: `
                <div class="mobileCenterControls_playerControlsInnerContainer__6MCmU">
                    <button class="og-icon" onclick="CONFIG.PLAYER.backward=10">
                        <svg width="60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                    </button>
                    <button id="main-play" class="og-icon" onclick="CONFIG.PLAYER.toggle()">
                        <svg width="80" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="og-icon" onclick="CONFIG.PLAYER.forward=10">
                        <svg width="60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
                    </button>
                </div>
            `
        }],
        customType: {
            m3u8: function(video, url) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                CONFIG.HLS = hls;
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    // Audio
                    if (hls.audioTracks.length) {
                        CONFIG.PLAYER.setting.add({
                            name: 'audio', html: 'Audio',
                            selector: hls.audioTracks.map((t, i) => ({ html: t.name || t.lang || `Track ${i+1}`, index: i })),
                            onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                        });
                    }
                    // Quality
                    if (hls.levels.length) {
                        CONFIG.PLAYER.setting.add({
                            name: 'quality', html: 'Quality',
                            selector: [{html: 'Auto', index: -1}, ...hls.levels.map((l, i) => ({ html: `${l.height}P`, index: i }))],
                            onSelect: (item) => { hls.currentLevel = item.index; return item.html; }
                        });
                    }
                    // Subtitles
                    CONFIG.PLAYER.setting.add({
                        name: 'subs', html: 'Subtitles',
                        selector: [{html: 'Off', url: ''}, ...subs.map(s => ({ html: s.lang || s.language || 'Sub', url: CONFIG.PROXY(s.url) }))],
                        onSelect: (item) => {
                            if (item.url) { CONFIG.PLAYER.subtitle.url = item.url; CONFIG.PLAYER.subtitle.show = true; }
                            else { CONFIG.PLAYER.subtitle.show = false; document.getElementById('titan-sub-p').style.display='none'; }
                            return item.html;
                        }
                    });
                });
            }
        }
    });

    CONFIG.PLAYER.on('subtitleUpdate', (t) => {
        const p = document.getElementById('titan-sub-p');
        if (t) { p.innerHTML = t; p.style.display = 'block'; }
        else p.style.display = 'none';
    });

    CONFIG.PLAYER.on('play', () => { document.getElementById('main-play').innerHTML = '<svg width="80" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'; });
    CONFIG.PLAYER.on('pause', () => { document.getElementById('main-play').innerHTML = '<svg width="80" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>'; });
}

function terminate() {
    if (CONFIG.PLAYER) CONFIG.PLAYER.destroy();
    if (CONFIG.HLS) CONFIG.HLS.destroy();
    document.getElementById('player-shell').style.display = 'none';
    document.getElementById('titan-dashboard').classList.remove('db-hidden');
    window.history.pushState({}, '', '/');
}
