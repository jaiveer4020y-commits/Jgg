/**
 * TITAN V27.0 - CORE LOGIC
 */

const TITAN = {
    TMDB: '463dcd7993ab31d92eb586802fdeee6a',
    OMDB: '85eb6482',
    PROXY: (u) => `https://workingg.vercel.app/api/proxy?url=${encodeURIComponent(u)}`,
    PLAYER: null,
    HLS: null
};

// 1. THE DEEP SLUG PARSER
window.onload = function() {
    const path = window.location.pathname.split('/').filter(p => p !== "");
    
    if (path.length > 0) {
        // If path exists, hide dashboard and start extraction
        document.getElementById('api-dashboard').style.display = 'none';
        parseAndBoot(path);
    }
};

async function parseAndBoot(path) {
    const lyr = document.getElementById('loading-lyr');
    lyr.style.display = 'flex';

    let id, s, e, mode, metadata;

    // Detect Mode
    if (path[0] === 'movie') {
        mode = 'movie';
        id = path[1];
    } else if (path[0] === 'tv') {
        mode = 'tv';
        id = path[1];
        s = path[2];
        e = path[3];
    } else {
        // Default to TV if pattern is /1399/1/1
        id = path[0];
        s = path[1];
        e = path[2];
        mode = s ? 'tv' : 'movie';
    }

    // 2. EXCLUSIVE METADATA FETCH (TMDB/OMDB)
    try {
        metadata = await fetch(`https://api.themoviedb.org/3/${mode}/${id}?api_key=${TITAN.TMDB}`).then(r => r.json());
        
        if (!metadata.id) { // OMDB Fallback
            metadata = await fetch(`https://www.omdbapi.com/?apikey=${TITAN.OMDB}&i=${id}`).then(r => r.json());
        }

        // Setup Loading Layer
        const title = metadata.title || metadata.name || metadata.Title;
        const year = (metadata.release_date || metadata.first_air_date || metadata.Year || "").split('-')[0];
        const backdrop = metadata.backdrop_path ? `https://image.tmdb.org/t/p/original${metadata.backdrop_path}` : metadata.Poster;

        document.getElementById('loading-title').innerText = title;
        document.getElementById('exclusive-backdrop').src = backdrop;

        // 3. GENERATE DEEP SLUG
        let slug;
        if (mode === 'tv') {
            const S = s.padStart(2, '0');
            const E = e.padStart(2, '0');
            slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '.')}.s${S}e${E}`;
        } else {
            slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${year}`;
        }

        console.log("Denoted Slug:", `?title=${slug}&id=${id}&season=${s}&episode=${e}`);

        // 4. FETCH STREAM & SUBS
        const subApi = `https://sub.wyzie.ru/search?id=${id}${mode === 'tv' ? `&season=${s}&episode=${e}` : ''}`;
        const streamApi = `https://u-1-1azw.onrender.com/api/get-stream?title=${slug}&id=${id}&season=${s}&episode=${e}`;

        const [subs, stream] = await Promise.all([
            fetch(TITAN.PROXY(subApi)).then(r => r.json()),
            fetch(TITAN.PROXY(streamApi)).then(r => r.json())
        ]);

        if (stream.m3u8_url) {
            initArt(TITAN.PROXY(stream.m3u8_url), subs, slug);
        } else {
            alert("No stream found for denoted slug.");
            lyr.style.display = 'none';
        }

    } catch (err) {
        console.error(err);
        lyr.style.display = 'none';
    }
}

// 5. MASTER PLAYER INITIALIZATION
function initArt(url, subs, slug) {
    document.getElementById('player-terminal').style.display = 'block';
    document.getElementById('loading-lyr').style.display = 'none';

    if (TITAN.PLAYER) TITAN.PLAYER.destroy();

    TITAN.PLAYER = new Artplayer({
        container: '#art-mount',
        url: url,
        type: 'm3u8',
        autoplay: true,
        fullscreen: true,
        setting: true,
        theme: '#E50914',
        layers: [
            {
                name: 'sub-layer',
                html: `<div class="SubtitleVideoCaption_mobileSubtitleContainer__vo_7_"><p id="titansub"></p></div>`
            },
            {
                name: 'center-icons',
                html: `
                    <div class="mobileCenterControls_playerControlsInnerContainer__6MCmU">
                        <button class="btn-og" onclick="TITAN.PLAYER.backward=10">
                            <svg width="60" viewBox="0 0 24 24" fill="white"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="10" y="15" font-size="4" fill="white" font-weight="900">10</text></svg>
                        </button>
                        <button id="mainplay" class="btn-og" style="width:100px;" onclick="TITAN.PLAYER.toggle()">
                            <svg width="80" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button class="btn-og" onclick="TITAN.PLAYER.forward=10">
                            <svg width="60" viewBox="0 0 24 24" fill="white"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="10" y="15" font-size="4" fill="white" font-weight="900">10</text></svg>
                        </button>
                    </div>
                `
            }
        ],
        customType: {
            m3u8: function(video, url) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    // Audio Switcher
                    if(hls.audioTracks.length) {
                        TITAN.PLAYER.setting.add({
                            name: 'audio', html: 'Audio',
                            selector: hls.audioTracks.map((t, i) => ({ html: t.name || t.lang || `Track ${i+1}`, index: i })),
                            onSelect: (item) => { hls.audioTrack = item.index; return item.html; }
                        });
                    }
                    // Subtitle Switcher
                    TITAN.PLAYER.setting.add({
                        name: 'subs', html: 'Subtitles',
                        selector: [{html: 'Off', url: ''}, ...subs.map(s => ({ html: s.lang || 'Unknown', url: TITAN.PROXY(s.url) }))],
                        onSelect: (item) => {
                            if(item.url) { TITAN.PLAYER.subtitle.url = item.url; TITAN.PLAYER.subtitle.show = true; }
                            else { TITAN.PLAYER.subtitle.show = false; document.getElementById('titansub').style.display='none'; }
                            return item.html;
                        }
                    });
                });
            }
        }
    });

    TITAN.PLAYER.on('subtitleUpdate', (text) => {
        const p = document.getElementById('titansub');
        if(text) { p.innerHTML = text; p.style.display = 'block'; }
        else p.style.display = 'none';
    });
}
