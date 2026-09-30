(() => {
    const element = document.getElementById('cinemata-analytics-config');
    if (!element) return;

    const config = JSON.parse(element.textContent);
    const tag = config.media_id ? `media:${config.media_id}` : undefined;
    const referrer = config.nonpublic || !document.referrer ? '' : (() => {
        try {
            const url = new URL(document.referrer);
            return ['http:', 'https:'].includes(url.protocol) ? `${url.protocol}//${url.hostname}/` : '';
        } catch { return ''; }
    })();
    const pending = [];
    const eventName = /^[a-z][a-z0-9_]{0,49}$/;
    const routeName = /^[a-zA-Z0-9_-]{1,64}$/;

    window.cinemataAnalyticsBeforeSend = (_type, payload) => {
        if (payload.name && !eventName.test(payload.name)) return false;
        const mediaId = /^media:([0-9a-f-]{36})$/.exec(payload.tag || '')?.[1];
        const data = mediaId ? {
            media_id: mediaId,
            media_type: ['video', 'audio', 'image', 'pdf', 'document'].includes(payload.data?.media_type) ? payload.data.media_type : 'other',
            context: ['page', 'embed', 'hero'].includes(payload.data?.context) ? payload.data.context : 'page',
        } : {};
        if (mediaId && /^[0-9a-f-]{36}$/.test(payload.data?.revision || '')) data.revision = payload.data.revision;
        if (payload.name === 'playback_start' && ['deliberate', 'autoplay', 'unknown'].includes(payload.data?.initiation)) {
            data.initiation = payload.data.initiation;
        }
        if (payload.name === 'player_error') {
            data.category = /^media_[1-4]$/.test(payload.data?.category) ? payload.data.category : 'other';
        }
        if (payload.name === 'outbound_click' && /^[a-z0-9.-]{1,253}$/i.test(payload.data?.destination || '')) {
            data.destination = payload.data.destination;
        }
        if (payload.name === 'media_view' && !config.nonpublic &&
            /^[a-z0-9.-]{1,253}$/i.test(payload.data?.source_domain || '')) {
            data.source_domain = payload.data.source_domain;
        }
        const virtualPath = !config.media_id && /^\/page\/[a-zA-Z0-9_-]{1,64}$/.test(payload.url || '') ? payload.url : null;
        return {
            website: config.website_id,
            hostname: window.location.hostname,
            url: payload.url === '/media/hero' && mediaId && !config.media_id ? '/media/hero' : virtualPath || config.path,
            title: mediaId ? 'Media' : 'Page',
            referrer,
            ...(mediaId ? { tag: `media:${mediaId}` } : {}),
            ...(payload.name ? { name: payload.name, data } : mediaId ? { data } : {}),
        };
    };

    function hasDoNotTrack() {
        return [navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack]
            .some((value) => value === 1 || value === '1' || value === 'yes');
    }

    function sendSegment(event) {
        if (!config.segment_grant || !window.fetch || hasDoNotTrack()) return;
        window.fetch('/analytics/segment-event', {
            method: 'POST', credentials: 'same-origin', keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant: config.segment_grant, event }),
        }).catch(() => {});
    }

    function send(name, data = {}, media = null) {
        if (!eventName.test(name)) return;
        sendSegment(name);
        if (!config.url || !config.website_id) return;
        const track = () => {
            const mediaId = media?.id || config.media_id;
            window.umami.track((props) => ({
                ...props,
                name,
                tag: mediaId ? `media:${mediaId}` : undefined,
                url: media ? '/media/hero' : config.path,
                title: mediaId ? 'Media' : 'Page',
                referrer,
                data: {
                    ...(mediaId ? { media_id: mediaId, media_type: media?.type || config.media_type, context: media?.context || config.context, revision: media?.revision || config.revision } : {}),
                    ...data,
                },
            }));
        };
        if (!window.umami) {
            pending.push(track);
            return;
        }
        track();
    }

    function pageview(name) {
        if (config.media_id || !routeName.test(name)) return;
        sendSegment('page_view');
        if (!config.url || !config.website_id) return;
        const track = () => window.umami.track({ website: config.website_id, url: `/page/${name}`, title: 'Page', referrer });
        if (!window.umami) {
            pending.push(track);
            return;
        }
        track();
    }

    function attachTextReading() {
        const milestones = [15, 30, 60, 120, 300];
        let elapsed = 0;
        let activeSince = null;
        let next = 0;
        let timer = null;

        function pause() {
            if (activeSince !== null) elapsed += performance.now() - activeSince;
            activeSince = null;
            window.clearTimeout(timer);
        }

        function resume() {
            if (activeSince !== null || next === milestones.length ||
                document.visibilityState !== 'visible' || !document.hasFocus()) return;
            activeSince = performance.now();
            timer = window.setTimeout(() => {
                if (document.visibilityState !== 'visible' || !document.hasFocus()) {
                    pause();
                    return;
                }
                elapsed += performance.now() - activeSince;
                send(`text_read_${milestones[next]}s`);
                next += 1;
                activeSince = null;
                resume();
            }, Math.max(0, milestones[next] * 1000 - elapsed));
        }

        document.addEventListener('visibilitychange', () => { pause(); resume(); });
        window.addEventListener('focus', resume);
        window.addEventListener('blur', pause);
        window.addEventListener('pagehide', pause);
        resume();
    }

    if (config.text_page) attachTextReading();

    function attachPlayer(player, media = null) {
        if (!(media?.id || config.media_id) || !player) return;
        const track = (name, data) => send(name, data, media);
        const measurementToken = media?.measurement_token || config.measurement_token;
        let milestones = new Set();
        let started = false;
        let muted = player.muted();
        let fullscreen = player.isFullscreen();
        let play = null;
        let playInitiation = 'unknown';
        let lastSample = null;
        let visible = true;
        let recentPlayerIntent = 0;
        const isAudio = (media?.type || config.media_type) === 'audio';
        const playerElement = player.el?.();
        if (!isAudio && playerElement && window.IntersectionObserver) {
            new IntersectionObserver(([entry]) => {
                visible = entry.intersectionRatio >= 0.5;
                lastSample = null;
            }, { threshold: [0, 0.5, 1] }).observe(playerElement);
        }
        playerElement?.addEventListener('pointerdown', () => { recentPlayerIntent = Date.now(); }, true);
        playerElement?.addEventListener('keydown', () => { recentPlayerIntent = Date.now(); }, true);
        document.addEventListener('visibilitychange', () => { lastSample = null; });

        function initiation() {
            let navigationIntent = false;
            try {
                const saved = JSON.parse(sessionStorage.getItem('cinemata-media-intent') || 'null');
                navigationIntent = saved && Date.now() - saved.time < 30000 &&
                    (saved.url === window.location.href.split('#')[0] || saved.url === 'next');
                sessionStorage.removeItem('cinemata-media-intent');
            } catch { /* Storage may be unavailable in an embed. */ }
            if (navigationIntent || Date.now() - recentPlayerIntent < 5000) return 'deliberate';
            return player.autoplay?.() ? 'autoplay' : 'unknown';
        }

        function snapshot() {
            if (!play || !measurementToken || !navigator.sendBeacon ||
                hasDoNotTrack()) return;
            const body = JSON.stringify({
                token: measurementToken,
                play_id: play.id,
                duration_ms: play.duration,
                coverage: play.coverage,
                watch_days: play.days,
                initiation: play.initiation,
            });
            if (body.length <= 65536) navigator.sendBeacon('/analytics/playback', new Blob([body], { type: 'application/json' }));
        }

        function observed(includeStopped = false) {
            if (!started || (!includeStopped && player.paused?.()) || player.seeking?.() || player.readyState?.() < 3) return false;
            if (isAudio || document.pictureInPictureElement === playerElement?.querySelector?.('video')) return true;
            return document.visibilityState === 'visible' && visible;
        }

        function sample(includeStopped = false) {
            const duration = player.duration();
            const current = player.currentTime();
            const wall = performance.now();
            if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) {
                lastSample = null;
                return;
            }
            if (!play && started && crypto.randomUUID && measurementToken) {
                play = {
                    id: crypto.randomUUID(), duration: Math.round(duration * 1000),
                    initiation: playInitiation, coverage: [], days: {},
                };
                snapshot();
            }
            if (!play || !observed(includeStopped)) {
                lastSample = null;
                return;
            }
            if (lastSample) {
                const elapsed = wall - lastSample.wall;
                const advanced = (current - lastSample.current) * 1000;
                const rate = player.playbackRate?.() || 1;
                if (elapsed > 0 && elapsed < 5000 && advanced > 0 && advanced <= elapsed * rate * 1.5 + 100) {
                    const start = Math.max(0, Math.round(lastSample.current * 1000));
                    const end = Math.min(play.duration, Math.round(current * 1000));
                    if (end > start) {
                        play.coverage.push([start, end]);
                        play.coverage.sort((a, b) => a[0] - b[0]);
                        play.coverage = play.coverage.reduce((ranges, range) => {
                            if (ranges.length && range[0] <= ranges[ranges.length - 1][1]) {
                                ranges[ranges.length - 1][1] = Math.max(range[1], ranges[ranges.length - 1][1]);
                            } else ranges.push(range);
                            return ranges;
                        }, []);
                        const endEpoch = Date.now();
                        let cursor = endEpoch - elapsed;
                        while (cursor < endEpoch) {
                            const date = new Date(cursor);
                            const day = date.toISOString().slice(0, 10);
                            const nextMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
                            const next = Math.min(endEpoch, nextMidnight);
                            play.days[day] = (play.days[day] || 0) + Math.round(next - cursor);
                            cursor = next;
                        }
                        const watched = play.coverage.reduce((total, range) => total + range[1] - range[0], 0);
                        [25, 50, 75].forEach((percent) => {
                            if (watched >= play.duration * percent / 100 && !milestones.has(percent)) {
                                milestones.add(percent);
                                track(`progress_${percent}`);
                            }
                        });
                    }
                }
            }
            lastSample = { wall, current };
        }

        const snapshotTimer = window.setInterval(() => { if (play) snapshot(); }, 60000);
        window.addEventListener('pagehide', snapshot);
        player.on?.('dispose', () => {
            snapshot();
            window.clearInterval(snapshotTimer);
            window.removeEventListener('pagehide', snapshot);
        });

        player.on('play', () => {
            track('play');
            if (!started) {
                playInitiation = initiation();
                track('playback_start', { initiation: playInitiation });
                started = true;
                sample();
            }
        });
        player.on('pause', () => {
            sample(true);
            lastSample = null;
            snapshot();
            if (!player.ended()) track('pause');
        });
        player.on('ended', () => {
            sample(true);
            snapshot();
            track('finish');
            started = false;
            milestones = new Set();
            play = null;
            lastSample = null;
        });
        player.on('timeupdate', () => sample());
        player.on('seeking', () => { lastSample = null; track('seek'); });
        player.on('waiting', () => { lastSample = null; });
        player.on('stalled', () => { lastSample = null; });
        player.on('playing', () => { lastSample = null; });
        player.on('volumechange', () => {
            if (muted !== player.muted()) {
                muted = player.muted();
                track(muted ? 'mute' : 'unmute');
            }
        });
        player.on('fullscreenchange', () => {
            if (fullscreen !== player.isFullscreen()) {
                fullscreen = player.isFullscreen();
                track(fullscreen ? 'fullscreen_on' : 'fullscreen_off');
            }
        });
        player.on('error', () => {
            const code = player.error()?.code;
            track('player_error', { category: [1, 2, 3, 4].includes(code) ? `media_${code}` : 'other' });
        });
    }

    window.CinemataAnalytics = {
        track: send, pageview, attachPlayer, mediaId: config.media_id || null,
        markNavigationIntent: () => {
            try { sessionStorage.setItem('cinemata-media-intent', JSON.stringify({ url: 'next', time: Date.now() })); }
            catch { /* Storage may be unavailable. */ }
        },
    };

    sendSegment('page_view');

    if (config.url && config.website_id) {
        const script = document.createElement('script');
        script.src = `${config.url}/script.js`;
        script.async = true;
        script.dataset.websiteId = config.website_id;
        script.dataset.autoPageview = 'false';
        script.dataset.doNotTrack = 'true';
        script.dataset.excludeSearch = 'true';
        script.dataset.excludeHash = 'true';
        script.dataset.domains = window.location.hostname;
        script.dataset.beforeSend = 'cinemataAnalyticsBeforeSend';
        script.onload = () => {
            window.umami.track({ website: config.website_id, url: config.path, title: config.media_id ? 'Media' : 'Page', referrer, tag, data: config.media_id ? { media_type: config.media_type, context: config.context, revision: config.revision } : undefined });
            if (config.media_id) send('media_view', referrer ? { source_domain: new URL(referrer).hostname } : {});
            while (pending.length) pending.shift()();
        };
        document.head.append(script);
    }

    document.addEventListener('click', (event) => {
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!link) return;
        let destination;
        try { destination = new URL(link.href, window.location.href); } catch { return; }
        if (link.hasAttribute('download')) send('download_click');
        if (destination.origin === window.location.origin) {
            try {
                sessionStorage.setItem('cinemata-media-intent', JSON.stringify({
                    url: destination.href.split('#')[0], time: Date.now(),
                }));
            } catch { /* Storage may be unavailable. */ }
        }
        if (destination.protocol.startsWith('http') && destination.hostname !== window.location.hostname) {
            send('outbound_click', { destination: destination.hostname });
        }
    });
})();
