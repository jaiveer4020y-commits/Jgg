/**
 * TITAN V30.0 - OMNIPOTENT ARCHIVE LOGIC
 */

const ARCHIVE = {
    TMDB: '463dcd7993ab31d92eb586802fdeee6a',
    OMDB: '85eb6482',
    PROXY: (url) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(url)}`,
    STATE: { id: null, type: 'tv', title: '', year: '' },
    PLAYER: null,
    HLS: null,
    SUBS: []
};

// --- 1. SEARCH & METADATA ENGINE ---
const queryInput = document.getElementById('query-input');
const matrix = document.getElementById('search-matrix');

queryInput.addEventListener('input', async (e) => {
    const q = e.target.value;
    if(q.length < 2) { matrix.style.display = 'none'; return; }

    const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${ARCHIVE.TMDB}&query=${q}`).then(r => r.json());
    const results = r.results || [];

    matrix.innerHTML = '';
    matrix.style.display = 'block';

    results.slice(0, 6).forEach(item => {
        if(item.media_type !== 'movie' && item.media_type !== 'tv') return;
        const div = document.createElement('div');
        div.className = 'res-row';
        const img = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : 'https://via.placeholder.com/92x138/000/fff?text=?';
        div.innerHTML = `
            <img src="${img}">
            <div>
                <b style="font-size:16px;">${item.title || item.name}</b><br>
                <small style="color:#555;">${(item.release_date || item.first_air_date || '').split('-')[0]}</small>
            </div>
        `;
        div.onclick = () => {
            ARCHIVE.STATE = {
                id: item.id,
                type: item.media_type,
                title: item.title || item.name,
                year: (item.release_date || item.first_air_date || '').split('-')[0]
            };
            queryInput.value = ARCHIVE.STATE.title;
            matrix.style.display = 'none';
            setMode(ARCHIVE.STATE.type);
        };
        matrix.appendChild(div);
    });
});

function setMode(m) {
    ARCHIVE.STATE.type = m;
    document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${m}`).classList.add('active');
    document.getElementById('tv-logic').style.display = m === 'tv' ? 'grid' : 'none';
}

// --- 2. DEEP SLUG & LAUNCH SEQUENCE ---
async function initiateLaunch() {
    if(!ARCHIVE.STATE.id) return alert("Select a title first.");

    const s = document.getElementById('s-val').value;
    const e = document.getElementById('e-val').value;

    const lyr = document.getElementById('loading-lyr');
    lyr.style.display = 'flex';

    try {
        // Fetch IMDB-style OG Metadata for Loading Layer
        const meta = await fetch(`https://api.themoviedb.org/3/${ARCHIVE.STATE.type}/${ARCHIVE.STATE.id}?api_key=${ARCHIVE.TMDB}`).then(r => r.json());
        document.getElementById('og-backdrop').src = `https://image.tmdb.org/t/p/original${meta.backdrop_path}`;
        document.getElementById('og-title').innerText = ARCHIVE.STATE.title;

        // Generate Denoted Slug
        let slug;
        if(ARCHIVE.STATE.type === 'tv') {
            slug = `${ARCHIVE.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.s${s.padStart(2,'0')}e${e.padStart(2,'0')}`;
        } else {
            slug = `${ARCHIVE.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.${ARCHIVE.STATE.year}`;
        }

        console.log("Denoted Slug Params:", `?title=${slug}&id=${ARCHIVE.STATE.id}&season=${s}&episode=${e}`);

        // Fetch Subtitles and Stream
        const subApi = `https://sub.wyzie.ru/search?id=${ARCHIVE.STATE.id}${ARCHIVE.STATE.type === 'tv' ? `&season=${s}&episode=${e}` : ''}`;
        const streamApi = `https://u-1-1azw.onrender.com/api/get-stream?title=${slug}&id=${ARCHIVE.STATE.id}&season=${s}&episode=${e}`;

        const [sRes, mRes] = await Promise.all([
            fetch(ARCHIVE.PROXY(subApi)).then(r => r.json()),
            fetch(ARCHIVE.PROXY(streamApi)).then(r => r.json())
        ]);

        ARCHIVE.SUBS = Array.isArray(sRes) ? sRes : [];

        if(mRes.m3u8_url) {
            startSupremePlayer(ARCHIVE.PROXY(mRes.m3u8_url));
        } else {
            alert("Stream not found for this slug.");
            lyr.style.display = 'none';
        }

    } catch(err) {
        lyr.style.display = 'none';
    }
}

// --- 3. THE SUPREME ARTPLAYER SYSTEM ---
function startSupremePlayer(url) {
    document.getElementById('player-terminal').style.display = 'block';
    document.getElementById('loading-lyr').style.display = 'none';
    document.getElementById('master-ui').classList.add('ui-collapsed');

    if(ARCHIVE.PLAYER) ARCHIVE.PLAYER.destroy();

    ARCHIVE.PLAYER = new Artplayer({
        container: '#art-mount',
        url: url,
        type: 'm3u8',
        autoplay: true,
        fullscreen: true,
        setting: true,
        theme: '#E50914',
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        settings: [
            {
                html: 'Subtitle Delay',
                width: 200,
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
                    ARCHIVE.PLAYER.subtitleOffset = item.value;
                    return item.html;
                },
            }
        ],
        layers: [
            {
                name: 'manual-sub-layer',
                html: `<div class="SubtitleVideoCaption_mobileSubtitleContainer__vo_7_"><p id="titan-render"></p></div>`
            },
            {
                name: 'netflix-icons',
                html: `
                    <div class="mobileCenterControls_playerControlsInnerContainer__6MCmU">
                        <button class="og-icon-btn" onclick="ARCHIVE.PLAYER.backward=10">
                            <svg width="60" viewBox="0 0 24 24" fill="white"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="10" y="15" font-size="4" font-weight="900" fill="white">10</text></svg>
                        </button>
                        <button id="p-main" class="og-icon-btn" style="width:100px;" onclick="ARCHIVE.PLAYER.toggle()">
                            <svg width="80" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button class="og-icon-btn" onclick="ARCHIVE.PLAYER.forward=10">
                            <svg width="60" viewBox="0 0 24 24" fill="white"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="10" y="15" font-size="4" font-weight="900" fill="white">10</text></svg>
                        </button>
                    </div>
                `
            }
        ],
        customType: {
            m3u8: function (video, url) {
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                    ARCHIVE.HLS = hls;

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        // 1. Audio Switcher (Manifest Deep Scan)
                        if (hls.audioTracks.length) {
                            ARCHIVE.PLAYER.setting.add({
                                name: 'audio', html: 'Audio',
                                selector: hls.audioTracks.map((t, i) => ({ html: t.name || t.lang || `Audio ${i+1}`, index: i })),
                                onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                            });
                        }

                        // 2. Quality Switcher
                        if (hls.levels.length) {
                            ARCHIVE.PLAYER.setting.add({
                                name: 'quality', html: 'Quality',
                                selector: [{ html: 'Auto', index: -1 }, ...hls.levels.map((l, i) => ({ html: `${l.height}P`, index: i }))],
                                onSelect: (item) => { hls.currentLevel = item.index; return item.html; }
                            });
                        }

                        // 3. Subtitle Mapper (Network Request Fix)
                        ARCHIVE.PLAYER.setting.add({
                            name: 'subs', html: 'Subtitles',
                            selector: [{ html: 'Off', url: '' }, ...ARCHIVE.SUBS.map(s => ({ 
                                html: s.lang || 'Unknown', 
                                url: ARCHIVE.PROXY(s.url) 
                            }))],
                            onSelect: (item) => {
                                if (item.url) {
                                    ARCHIVE.PLAYER.subtitle.url = item.url;
                                    ARCHIVE.PLAYER.subtitle.show = true;
                                } else {
                                    ARCHIVE.PLAYER.subtitle.show = false;
                                    document.getElementById('titan-render').style.display = 'none';
                                }
                                return item.html;
                            }
                        });
                    });
                }
            }
        }
    });

    // Forced Render to Specific Div
    ARCHIVE.PLAYER.on('subtitleUpdate', (text) => {
        const el = document.getElementById('titan-render');
        if (text) {
            el.innerHTML = text;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    });

    ARCHIVE.PLAYER.on('play', () => { document.getElementById('p-main').innerHTML = '<svg width="80" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'; });
    ARCHIVE.PLAYER.on('pause', () => { document.getElementById('p-main').innerHTML = '<svg width="80" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>'; });
}

function killTitan() {
    if (ARCHIVE.PLAYER) ARCHIVE.PLAYER.destroy();
    if (ARCHIVE.HLS) ARCHIVE.HLS.destroy();
    document.getElementById('player-terminal').style.display = 'none';
    document.getElementById('master-ui').classList.remove('ui-collapsed');
}
