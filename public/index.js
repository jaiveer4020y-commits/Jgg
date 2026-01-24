/**
 * TITAN V31.0 - PATHFINDER ENGINE
 */

const TITAN = {
    TMDB: '463dcd7993ab31d92eb586802fdeee6a',
    PROXY: (u) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(u)}`,
    STATE: { id: null, type: 'tv', title: '', s: 1, e: 1, year: '' },
    PLAYER: null,
    HLS: null
};

// --- CORE: URL LISTENER (THE FIX) ---
window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').filter(Boolean);
    
    // Check for patterns like /1399/1/1 or /movie/671
    if (path.length > 0) {
        document.getElementById('titan-dashboard').classList.add('dashboard-hidden');
        
        if (path[0] === 'movie') {
            TITAN.STATE.type = 'movie';
            TITAN.STATE.id = path[1];
        } else if (path.length >= 3) {
            TITAN.STATE.type = 'tv';
            TITAN.STATE.id = path[0];
            TITAN.STATE.s = path[1];
            TITAN.STATE.e = path[2];
        } else {
            TITAN.STATE.type = 'movie';
            TITAN.STATE.id = path[0];
        }
        
        if (TITAN.STATE.id) runPathfinder();
    }
});

// --- SEARCH ENGINE ---
document.getElementById('search-input').addEventListener('input', async (e) => {
    const q = e.target.value;
    const resBox = document.getElementById('search-results');
    if (q.length < 2) { resBox.style.display = 'none'; return; }

    const data = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TITAN.TMDB}&query=${q}`).then(r => r.json());
    resBox.innerHTML = '';
    resBox.style.display = 'block';

    (data.results || []).slice(0, 5).forEach(item => {
        if (item.media_type === 'person') return;
        const div = document.createElement('div');
        div.className = 'res-item';
        div.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${item.poster_path}"><div><b>${item.title || item.name}</b></div>`;
        div.onclick = () => {
            TITAN.STATE.id = item.id;
            TITAN.STATE.type = item.media_type;
            TITAN.STATE.title = item.title || item.name;
            document.getElementById('search-input').value = TITAN.STATE.title;
            resBox.style.display = 'none';
        };
        resBox.appendChild(div);
    });
});

async function manualLaunch() {
    if (!TITAN.STATE.id) return alert("Select a title.");
    runPathfinder();
}

// --- MASTER BOOT LOGIC ---
async function runPathfinder() {
    const lyr = document.getElementById('loading-layer');
    lyr.style.display = 'flex';

    try {
        // 1. Fetch IMDb Exclusive Metadata
        const meta = await fetch(`https://api.themoviedb.org/3/${TITAN.STATE.type}/${TITAN.STATE.id}?api_key=${TITAN.TMDB}`).then(r => r.json());
        TITAN.STATE.title = meta.title || meta.name;
        TITAN.STATE.year = (meta.release_date || meta.first_air_date || '').split('-')[0];

        document.getElementById('og-backdrop').src = `https://image.tmdb.org/t/p/original${meta.backdrop_path}`;
        document.getElementById('og-title').innerText = TITAN.STATE.title;

        // 2. Slug Denoter
        let slug;
        if (TITAN.STATE.type === 'tv') {
            slug = `${TITAN.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.s${String(TITAN.STATE.s).padStart(2,'0')}e${String(TITAN.STATE.e).padStart(2,'0')}`;
        } else {
            slug = `${TITAN.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.${TITAN.STATE.year}`;
        }

        // 3. Network Requests
        const subApi = `https://sub.wyzie.ru/search?id=${TITAN.STATE.id}${TITAN.STATE.type === 'tv' ? `&season=${TITAN.STATE.s}&episode=${TITAN.STATE.e}` : ''}`;
        const streamApi = `https://u-1-1azw.onrender.com/api/get-stream?title=${slug}&id=${TITAN.STATE.id}&season=${TITAN.STATE.s}&episode=${TITAN.STATE.e}`;

        const [subs, stream] = await Promise.all([
            fetch(TITAN.PROXY(subApi)).then(r => r.json()),
            fetch(TITAN.PROXY(streamApi)).then(r => r.json())
        ]);

        if (stream.m3u8_url) {
            bootArt(TITAN.PROXY(stream.m3u8_url), subs);
        } else {
            alert("No stream found for slug: " + slug);
            lyr.style.display = 'none';
        }
    } catch (e) {
        lyr.style.display = 'none';
    }
}

// --- SUPREME PLAYER ---
function bootArt(m3u8, subList) {
    document.getElementById('player-shell').style.display = 'block';
    document.getElementById('loading-layer').style.display = 'none';

    if (TITAN.PLAYER) TITAN.PLAYER.destroy();

    TITAN.PLAYER = new Artplayer({
        container: '#art-mount',
        url: m3u8,
        type: 'm3u8',
        autoplay: true,
        fullscreen: true,
        setting: true,
        aspectRatio: true,
        playbackRate: true,
        theme: '#E50914',
        settings: [
            {
                html: 'Subtitle Delay',
                tooltip: '0s',
                selector: [-5, -2, -1, 0, 1, 2, 5].map(v => ({ html: v + 's', value: v, default: v === 0 })),
                onSelect: (v) => { TITAN.PLAYER.subtitleOffset = v.value; return v.html; }
            }
        ],
        layers: [{
            name: 'sub-layer',
            html: `<div class="SubtitleVideoCaption_mobileSubtitleContainer__vo_7_"><p id="titan-sub-text"></p></div>`
        }],
        customType: {
            m3u8: function(video, url) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                TITAN.HLS = hls;
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    // Audio Switcher
                    if (hls.audioTracks.length) {
                        TITAN.PLAYER.setting.add({
                            name: 'audio', html: 'Audio',
                            selector: hls.audioTracks.map((t, i) => ({ html: t.name || t.lang || `Track ${i+1}`, index: i })),
                            onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                        });
                    }
                    // Quality Switcher
                    if (hls.levels.length) {
                        TITAN.PLAYER.setting.add({
                            name: 'quality', html: 'Quality',
                            selector: [{html: 'Auto', index: -1}, ...hls.levels.map((l, i) => ({ html: `${l.height}P`, index: i }))],
                            onSelect: (item) => { hls.currentLevel = item.index; return item.html; }
                        });
                    }
                    // Subtitle Mapper (Fix Unknown Language)
                    TITAN.PLAYER.setting.add({
                        name: 'subs', html: 'Subtitles',
                        selector: [{html: 'Off', url: ''}, ...subList.map(s => ({ html: s.lang || s.language || 'Sub', url: TITAN.PROXY(s.url) }))],
                        onSelect: (item) => {
                            if (item.url) { TITAN.PLAYER.subtitle.url = item.url; TITAN.PLAYER.subtitle.show = true; }
                            else { TITAN.PLAYER.subtitle.show = false; document.getElementById('titan-sub-text').style.display='none'; }
                            return item.html;
                        }
                    });
                });
            }
        }
    });

    // Forced Render to Div Container
    TITAN.PLAYER.on('subtitleUpdate', (t) => {
        const p = document.getElementById('titan-sub-text');
        if (t) { p.innerHTML = t; p.style.display = 'block'; }
        else p.style.display = 'none';
    });
}

function killEverything() {
    if (TITAN.PLAYER) TITAN.PLAYER.destroy();
    if (TITAN.HLS) TITAN.HLS.destroy();
    document.getElementById('player-shell').style.display = 'none';
    document.getElementById('titan-dashboard').classList.remove('dashboard-hidden');
    window.history.pushState({}, '', '/');
}
