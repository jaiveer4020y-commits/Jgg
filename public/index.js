/**
 * TITAN V33.0 - SUPREME LOGIC
 */

const CORE = {
    TMDB: '463dcd7993ab31d92eb586802fdeee6a',
    PROXY: (u) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(u)}`,
    PLAYER: null,
    HLS: null,
    STATE: { id: null, type: 'tv', s: 1, e: 1, title: '', year: '' }
};

// 1. URL PATHFINDER
window.onload = () => {
    const path = window.location.pathname.split('/').filter(Boolean);
    if (path.length > 0) {
        if (path[0] === 'movie') {
            CORE.STATE = { id: path[1], type: 'movie' };
        } else if (path.length >= 3) {
            CORE.STATE = { id: path[0], type: 'tv', s: path[1], e: path[2] };
        } else {
            CORE.STATE = { id: path[0], type: 'movie' };
        }
        bootEngine();
    }
};

function launch(path) {
    window.history.pushState({}, '', path);
    window.location.reload();
}

// 2. BOOT ENGINE (LOGO + POSTER + SLUG)
async function bootEngine() {
    document.getElementById('titan-dashboard').classList.add('db-hidden');
    const lyr = document.getElementById('loading-layer');
    lyr.style.display = 'flex';

    try {
        // Fetch Metadata, Backdrop, and Logos
        const [meta, imgs] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${CORE.STATE.type}/${CORE.STATE.id}?api_key=${CORE.TMDB}`).then(r => r.json()),
            fetch(`https://api.themoviedb.org/3/${CORE.STATE.type}/${CORE.STATE.id}/images?api_key=${CORE.TMDB}`).then(r => r.json())
        ]);

        CORE.STATE.title = meta.title || meta.name;
        CORE.STATE.year = (meta.release_date || meta.first_air_date || '').split('-')[0];

        // Set Netflix Backdrop
        document.getElementById('og-poster').src = `https://image.tmdb.org/t/p/original${meta.backdrop_path}`;
        
        // Find High-Res PNG Logo
        const logo = imgs.logos.find(l => l.file_path.endsWith('.png') && l.iso_639_1 === 'en') || imgs.logos[0];
        if (logo) {
            document.getElementById('exclusive-logo').src = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }

        // Slug Denoter
        let slug;
        if (CORE.STATE.type === 'tv') {
            slug = `${CORE.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.s${String(CORE.STATE.s).padStart(2,'0')}e${String(CORE.STATE.e).padStart(2,'0')}`;
        } else {
            slug = `${CORE.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.${CORE.STATE.year}`;
        }

        // Network Requests
        const subApi = `https://sub.wyzie.ru/search?id=${CORE.STATE.id}${CORE.STATE.type === 'tv' ? `&season=${CORE.STATE.s}&episode=${CORE.STATE.e}` : ''}`;
        const streamApi = `https://u-1-1azw.onrender.com/api/get-stream?title=${slug}&id=${CORE.STATE.id}&season=${CORE.STATE.s}&episode=${CORE.STATE.e}`;

        const [sData, mData] = await Promise.all([
            fetch(CORE.PROXY(subApi)).then(r => r.json()),
            fetch(CORE.PROXY(streamApi)).then(r => r.json())
        ]);

        if (mData.m3u8_url) {
            initArt(CORE.PROXY(mData.m3u8_url), sData);
        } else {
            alert("No Stream Found for Slug: " + slug);
            lyr.style.display = 'none';
        }

    } catch (e) {
        lyr.style.display = 'none';
        console.error(e);
    }
}

// 3. ARTPLAYER SUPREME CONFIG
function initArt(url, subList) {
    document.getElementById('player-terminal').style.display = 'block';
    document.getElementById('loading-layer').style.display = 'none';

    if (CORE.PLAYER) CORE.PLAYER.destroy();

    CORE.PLAYER = new Artplayer({
        container: '#art-mount',
        url: url,
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
                selector: [-5, -2, -1, 0, 1, 2, 5].map(v => ({ html: v + 's', value: v, default: v === 0 })),
                onSelect: (v) => { CORE.PLAYER.subtitleOffset = v.value; return v.html; }
            }
        ],
        customType: {
            m3u8: function(video, url) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                CORE.HLS = hls;
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    // 1. Audio Switcher
                    if (hls.audioTracks.length) {
                        CORE.PLAYER.setting.add({
                            name: 'audio', html: 'Audio',
                            selector: hls.audioTracks.map((t, i) => ({ html: t.name || t.lang || `Track ${i+1}`, index: i })),
                            onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                        });
                    }
                    // 2. Quality Switcher
                    if (hls.levels.length) {
                        CORE.PLAYER.setting.add({
                            name: 'quality', html: 'Quality',
                            selector: [{html: 'Auto', index: -1}, ...hls.levels.map((l, i) => ({ html: `${l.height}P`, index: i }))],
                            onSelect: (item) => { hls.currentLevel = item.index; return item.html; }
                        });
                    }
                    // 3. Subtitle Switer (Fix Unknown Language)
                    CORE.PLAYER.setting.add({
                        name: 'subs', html: 'Subtitles',
                        selector: [{html: 'Off', url: ''}, ...subList.map(s => ({ 
                            html: s.lang || s.language || 'Sub', 
                            url: CORE.PROXY(s.url) 
                        }))],
                        onSelect: (item) => {
                            if (item.url) {
                                CORE.PLAYER.subtitle.url = item.url;
                                CORE.PLAYER.subtitle.show = true;
                            } else {
                                CORE.PLAYER.subtitle.show = false;
                                document.getElementById('manual-sub-text').innerText = '';
                            }
                            return item.html;
                        }
                    });
                });
            }
        }
    });

    // MANUAL SUBTITLE DELIVERY SYSTEM
    CORE.PLAYER.on('subtitleUpdate', (text) => {
        const subBox = document.getElementById('manual-sub-text');
        if (text) {
            subBox.innerHTML = text;
            subBox.style.display = 'inline-block';
        } else {
            subBox.innerText = '';
            subBox.style.display = 'none';
        }
    });
}

function shutdown() {
    if (CORE.PLAYER) CORE.PLAYER.destroy();
    if (CORE.HLS) CORE.HLS.destroy();
    document.getElementById('player-terminal').style.display = 'none';
    document.getElementById('titan-dashboard').classList.remove('db-hidden');
    window.history.pushState({}, '', '/');
}
