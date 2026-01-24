/**
 * TITAN V29.0 SUPREME ARCHITECT CORE
 */

const SUPREME = {
    TMDB: '463dcd7993ab31d92eb586802fdeee6a',
    OMDB: '85eb6482',
    PROXY: (u) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(u)}`,
    STATE: { id: null, mode: 'tv', title: '', year: '' },
    PLAYER: null,
    HLS: null,
    SUBS: []
};

// 1. SEARCH SYSTEM
const search = document.getElementById('main-search');
const results = document.getElementById('search-results');

search.addEventListener('input', async (e) => {
    const q = e.target.value;
    if (q.length < 2) { results.style.display = 'none'; return; }

    const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${SUPREME.TMDB}&query=${q}`).then(res => res.json());
    
    results.innerHTML = '';
    results.style.display = 'block';
    
    r.results.slice(0, 6).forEach(item => {
        if (item.media_type === 'person') return;
        const div = document.createElement('div');
        div.className = 'res-item';
        const img = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : 'https://via.placeholder.com/92x138/000/fff?text=?';
        div.innerHTML = `<img src="${img}"><div><b style="font-size:18px">${item.title || item.name}</b><br><small style="color:#666">${(item.release_date || item.first_air_date || '').split('-')[0]}</small></div>`;
        
        div.onclick = () => {
            SUPREME.STATE = {
                id: item.id,
                mode: item.media_type,
                title: item.title || item.name,
                year: (item.release_date || item.first_air_date || '').split('-')[0]
            };
            search.value = SUPREME.STATE.title;
            results.style.display = 'none';
            document.getElementById('tv-controls').style.display = SUPREME.STATE.mode === 'tv' ? 'flex' : 'none';
            bootSequence();
        };
        results.appendChild(div);
    });
});

// 2. BOOT SEQUENCE (EXCLUSIVE METADATA)
async function bootSequence() {
    const lyr = document.getElementById('loading-layer');
    lyr.style.display = 'flex';

    const s = document.getElementById('s-val').value;
    const e = document.getElementById('e-val').value;

    try {
        // Fetch High-End Backdrop and OG Metadata
        const meta = await fetch(`https://api.themoviedb.org/3/${SUPREME.STATE.mode}/${SUPREME.STATE.id}?api_key=${SUPREME.TMDB}`).then(r => r.json());
        document.getElementById('loading-backdrop').src = `https://image.tmdb.org/t/p/original${meta.backdrop_path}`;
        document.getElementById('exclusive-title').innerText = SUPREME.STATE.title;

        // DENOTED SLUG GENERATION
        let slug;
        if (SUPREME.STATE.mode === 'tv') {
            slug = `${SUPREME.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.s${s.padStart(2,'0')}e${e.padStart(2,'0')}`;
        } else {
            slug = `${SUPREME.STATE.title.toLowerCase().replace(/[^a-z0-9]/g,'.')}.${SUPREME.STATE.year}`;
        }

        // FETCH SUBS & STREAM
        const subUrl = `https://sub.wyzie.ru/search?id=${SUPREME.STATE.id}${SUPREME.STATE.mode === 'tv' ? `&season=${s}&episode=${e}` : ''}`;
        const streamUrl = `https://u-1-1azw.onrender.com/api/get-stream?title=${slug}&id=${SUPREME.STATE.id}&season=${s}&episode=${e}`;

        const [subRes, streamRes] = await Promise.all([
            fetch(SUPREME.PROXY(subUrl)).then(r => r.json()),
            fetch(SUPREME.PROXY(streamUrl)).then(r => r.json())
        ]);

        SUPREME.SUBS = Array.isArray(subRes) ? subRes : [];
        
        if (streamRes.m3u8_url) {
            initSupremePlayer(SUPREME.PROXY(streamRes.m3u8_url));
        } else {
            alert("Transmission Error: No Stream Found.");
            lyr.style.display = 'none';
        }

    } catch (err) {
        lyr.style.display = 'none';
    }
}

// 3. THE SUPREME ARTPLAYER
function initSupremePlayer(m3u8) {
    document.getElementById('player-container').style.display = 'block';
    document.getElementById('loading-layer').style.display = 'none';
    document.getElementById('titan-ui').classList.add('ui-hide');

    if (SUPREME.PLAYER) SUPREME.PLAYER.destroy();

    SUPREME.PLAYER = new Artplayer({
        container: '#art-mount',
        url: m3u8,
        type: 'm3u8',
        autoplay: true,
        fullscreen: true,
        setting: true,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        theme: '#E50914',
        settings: [
            {
                html: 'Subtitle Delay',
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
                    SUPREME.PLAYER.subtitleOffset = item.value;
                    return item.html;
                },
            },
        ],
        layers: [
            {
                name: 'manual-sub-container',
                html: `<div class="SubtitleVideoCaption_mobileSubtitleContainer__vo_7_"><p id="supreme-sub-render"></p></div>`
            },
            {
                name: 'og-controls',
                html: `
                    <div class="mobileCenterControls_playerControlsInnerContainer__6MCmU">
                        <button class="btn-supreme" onclick="SUPREME.PLAYER.backward=10">
                            <svg width="60" viewBox="0 0 24 24" fill="white"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="10" y="15" font-size="4" font-weight="900" fill="white">10</text></svg>
                        </button>
                        <button id="p-toggle" class="btn-supreme" style="width:100px;" onclick="SUPREME.PLAYER.toggle()">
                            <svg width="80" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button class="btn-supreme" onclick="SUPREME.PLAYER.forward=10">
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
                    SUPREME.HLS = hls;

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        // 1. Audio Switcher
                        if (hls.audioTracks.length) {
                            SUPREME.PLAYER.setting.add({
                                name: 'audio', html: 'Audio Language',
                                selector: hls.audioTracks.map((t, i) => ({
                                    html: t.name || t.lang || `Track ${i+1}`,
                                    index: i
                                })),
                                onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                            });
                        }

                        // 2. Quality Switcher
                        if (hls.levels.length) {
                            SUPREME.PLAYER.setting.add({
                                name: 'quality', html: 'Resolution',
                                selector: [{ html: 'Auto', index: -1 }, ...hls.levels.map((l, i) => ({ html: `${l.height}P`, index: i }))],
                                onSelect: (item) => { hls.currentLevel = item.index; return item.html; }
                            });
                        }

                        // 3. Subtitle Language Mapping
                        SUPREME.PLAYER.setting.add({
                            name: 'subs', html: 'Subtitles',
                            selector: [{ html: 'Off', url: '' }, ...SUPREME.SUBS.map(s => ({ 
                                html: s.lang || 'Unknown', 
                                url: SUPREME.PROXY(s.url) 
                            }))],
                            onSelect: (item) => {
                                if (item.url) {
                                    SUPREME.PLAYER.subtitle.url = item.url;
                                    SUPREME.PLAYER.subtitle.show = true;
                                } else {
                                    SUPREME.PLAYER.subtitle.show = false;
                                    document.getElementById('supreme-sub-render').style.display = 'none';
                                }
                                return item.html;
                            }
                        });
                    });
                }
            }
        }
    });

    // Forced Subtitle Renderer to Div
    SUPREME.PLAYER.on('subtitleUpdate', (text) => {
        const el = document.getElementById('supreme-sub-render');
        if (text) {
            el.innerHTML = text;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    });

    SUPREME.PLAYER.on('play', () => { document.getElementById('p-toggle').innerHTML = '<svg width="80" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'; });
    SUPREME.PLAYER.on('pause', () => { document.getElementById('p-toggle').innerHTML = '<svg width="80" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>'; });
}

function destroyPlayer() {
    if (SUPREME.PLAYER) SUPREME.PLAYER.destroy();
    if (SUPREME.HLS) SUPREME.HLS.destroy();
    document.getElementById('player-container').style.display = 'none';
    document.getElementById('titan-ui').classList.remove('ui-hide');
}
