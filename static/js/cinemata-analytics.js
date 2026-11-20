(() => {
    const element = document.getElementById('cinemata-analytics-config');
    if (!element) return;

    const config = JSON.parse(element.textContent);
    // Umami's heatmap loads the live page in an iframe on its own origin; tracking
    // there would count the analyst's preview as a visit. Firefox has no
    // ancestorOrigins, so a heatmap viewed in Firefox still counts.
    const analyticsOrigin = (() => { try { return new URL(config.url).origin; } catch { return null; } })();
    const isUmamiPreview = window.top !== window.self &&
        Array.from(window.location.ancestorOrigins || []).includes(analyticsOrigin);
    if (isUmamiPreview) return;
    // Matches every generic path the server and pageview() give a tracked page.
    const trackerPath = /^\/(?:media\/(?:view|embed)|user\/profile\/(?:home|media|playlists|about|impact)|page\/[a-zA-Z0-9_-]{1,64}|[a-zA-Z0-9_-]{1,200})?$/;
    const isTrackerPath = (path) => typeof path === 'string' && trackerPath.test(path);
    // Umami starts a new visit after 30 minutes without activity.
    const visitLength = 30 * 60 * 1000;
    function hasDoNotTrack() {
        return [navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack]
            .some((value) => value === 1 || value === '1' || value === 'yes');
    }
    // An embed sits on another site's page, so loading one is not movement within Cinemata.
    const isEmbed = config.context === 'embed';
    // Returns the tab's previously tracked page within this visit and records the current one.
    function advancePath(path) {
        if (hasDoNotTrack() || isEmbed) return null;
        let previous = null;
        try {
            const saved = JSON.parse(sessionStorage.getItem('cinemata-previous-path') || 'null');
            const age = Date.now() - saved?.time;
            if (age >= 0 && age < visitLength && isTrackerPath(saved.path)) previous = saved.path;
        } catch { /* Storage may be unavailable in an embed, or hold a value this tracker did not write. */ }
        try { sessionStorage.setItem('cinemata-previous-path', JSON.stringify({ path, time: Date.now() })); }
        catch { /* Storage may be unavailable in an embed. */ }
        return previous;
    }
    const landingPreviousPath = advancePath(config.path);
    const tag = config.media_id ? `media:${config.media_id}` : config.playlist_id ? `playlist:${config.playlist_id}` : undefined;
    // Umami v3.4.0 stores at most 500 characters each of a referrer's domain, path and query
    // (referrer_domain, referrer_path and referrer_query in prisma/schema.prisma).
    const referrerLength = 500;
    const siteHost = (hostname) => hostname.toLowerCase().replace(/^www\./, '');
    function sendableReferrer(value) {
        let url;
        try { url = new URL(value); } catch { return ''; }
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        // Cinemata URLs can hold usernames and access tokens; previous_path reports movement within the site.
        if (siteHost(url.hostname) === siteHost(window.location.hostname)) return `${url.protocol}//${url.hostname}/`;
        return `${url.origin}${url.pathname}${url.search}`.slice(0, referrerLength);
    }
    let referrer = config.nonpublic ? '' : sendableReferrer(document.referrer);
    const pending = [];
    // The function form lets Umami add the screen, language and distinct ID it collects.
    function emitUmami(payload) {
        try { window.umami.track((browser) => ({ ...browser, ...payload }))?.catch?.(() => {}); }
        catch { /* Collection must not interrupt the user's action. */ }
    }
    const eventName = /^[a-z][a-z0-9_]{0,49}$/;
    const routeName = /^[a-zA-Z0-9_-]{1,64}$/;
    // Umami reads campaign attribution from the query string of the landing view's URL.
    const campaignValue = /^[\w .~+-]{1,100}$/;
    const campaignQuery = config.nonpublic ? '' : (() => {
        const landing = new URLSearchParams(window.location.search);
        const campaign = new URLSearchParams();
        for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
            const value = landing.get(key);
            if (value && campaignValue.test(value)) campaign.set(key, value);
        }
        const query = campaign.toString();
        return query ? `?${query}` : '';
    })();
    const audienceGroups = ['anonymous', 'regular', 'trusted', 'curator'];
    const audienceFor = (group) => !config.nonpublic && audienceGroups.includes(group) ? group : null;
    // The server shortens long usernames to fit Umami's 50-character distinct ID.
    const identity = /^[\w.@+~-]{1,50}$/.test(config.identity?.id || '') &&
        audienceGroups.includes(config.identity.audience_group) ? config.identity : null;
    const screenSize = /^\d{1,5}x\d{1,5}$/;
    const languageTag = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}$/;
    const webVitals = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'];
    // ENCODE_RESOLUTIONS and CODECS in files/models.py.
    const downloadFile = /^(original|(2160|1440|1080|720|480|360|240)-(h264|h265|vp9))$/;
    const shareNetworks = ['email', 'fb', 'tw', 'reddit', 'tumblr', 'pinterest', 'vk', 'linkedin', 'mix', 'whatsapp', 'telegram'];
    function browserFields(payload) {
        return {
            ...(screenSize.test(payload.screen || '') ? { screen: payload.screen } : {}),
            ...(languageTag.test(payload.language || '') ? { language: payload.language } : {}),
            ...(identity ? { id: identity.id } : {}),
        };
    }
    let audienceGroup = audienceFor(config.audience_group);
    // Umami stores at most 500 characters of a page title or an event data string.
    const mediaTitle = (title) => typeof title === 'string' && title ? Array.from(title).slice(0, 500).join('') : null;
    const namedPageTitle = !config.media_id && !config.nonpublic ? mediaTitle(config.page_title) : null;
    // USERNAME_RE in users/urls.py uses Python's Unicode \w; usernames are at most 150 characters.
    const profileUsername = typeof config.profile_username === 'string' &&
        /^[\p{L}\p{N}_@.-]{1,150}$/u.test(config.profile_username) ? config.profile_username : null;
    // Each media item keeps the page context it was viewed with, for events
    // that wait for Umami to load while a playlist moves on in place.
    const mediaPages = new Map();
    function rememberMediaPage() {
        if (config.media_id) mediaPages.set(config.media_id, {
            title: config.nonpublic ? null : mediaTitle(config.title),
            audienceGroup,
            referrer,
            nonpublic: !!config.nonpublic,
        });
    }
    rememberMediaPage();
    const heroTitles = new Map();
    const privateActions = {
        journal_create: 'journal', journal_update: 'journal', journal_delete: 'journal',
        notification_click: 'notifications', notification_read: 'notifications', notifications_read_all: 'notifications',
        notification_preferences_save: 'preferences', contact_user_accepted: 'contact',
        profile_update: 'profile', channel_update: 'profile', account_delete: 'account',
        signup_success: 'account', signin_success: 'account', signout_success: 'account', newsletter_optin: 'account',
    };

    window.cinemataAnalyticsBeforeSend = (type, payload) => {
        const page = {
            website: config.website_id,
            hostname: window.location.hostname,
            url: config.path,
            title: mediaPages.get(config.media_id)?.title || (config.media_id ? 'Media' : namedPageTitle || 'Page'),
            ...browserFields(payload),
        };
        if (type === 'identify') return identity ? { ...page, data: { audience_group: identity.audience_group } } : false;
        if (type === 'performance') {
            return { ...page, ...Object.fromEntries(webVitals.filter((key) => Number.isFinite(payload[key])).map((key) => [key, payload[key]])) };
        }
        if (payload.name && !eventName.test(payload.name)) return false;
        const privatePath = Object.hasOwn(privateActions, payload.name) ? privateActions[payload.name] : null;
        const mediaId = privatePath ? null : /^media:([0-9a-f-]{36})$/.exec(payload.tag || '')?.[1];
        const mediaPage = mediaId ? mediaPages.get(mediaId) : null;
        const privacy = mediaPage || { audienceGroup, referrer, nonpublic: config.nonpublic };
        const data = mediaId ? {
            media_id: mediaId,
            media_type: ['video', 'audio', 'image', 'pdf', 'document'].includes(payload.data?.media_type) ? payload.data.media_type : 'other',
            context: ['page', 'embed', 'hero', 'playlist', 'workflow'].includes(payload.data?.context) ? payload.data.context : 'page',
        } : {};
        if (mediaId && /^[0-9a-f-]{36}$/.test(payload.data?.revision || '')) data.revision = payload.data.revision;
        const interactionPath = mediaId && ['/media/hero', '/media/playlist', '/media/workflow'].includes(payload.url) ? payload.url : null;
        const viewedPage = !interactionPath && ['page', 'embed'].includes(data.context) ? mediaPage : null;
        const heroTitle = interactionPath === '/media/hero' && data.context === 'hero' ? heroTitles.get(mediaId) : null;
        if (viewedPage?.title || heroTitle) data.media_title = viewedPage?.title || heroTitle;
        if (payload.name === 'playback_start' && ['deliberate', 'autoplay', 'unknown'].includes(payload.data?.initiation)) {
            data.initiation = payload.data.initiation;
        }
        if (payload.name === 'player_error') {
            data.category = /^media_[1-4]$/.test(payload.data?.category) ? payload.data.category : 'other';
        }
        if (payload.name === 'outbound_click' && /^[a-z0-9.-]{1,253}$/i.test(payload.data?.destination || '')) {
            data.destination = payload.data.destination;
        }
        if (payload.name === 'media_share_click' && shareNetworks.includes(payload.data?.network)) {
            data.network = payload.data.network;
        }
        if (payload.name === 'download_click' && typeof payload.data?.file === 'string' && downloadFile.test(payload.data.file)) {
            data.file = payload.data.file;
        }
        if (payload.name === 'media_view' && !privacy.nonpublic &&
            /^[a-z0-9.-]{1,253}$/i.test(payload.data?.source_domain || '')) {
            data.source_domain = payload.data.source_domain;
        }
        // Umami's Event data breaks down properties of named events only, so page_view carries it too.
        const isPageView = !payload.name || payload.name === 'page_view';
        if (isPageView && !privacy.nonpublic && isTrackerPath(payload.data?.previous_path)) {
            data.previous_path = payload.data.previous_path;
        }
        if (!privatePath) {
            for (const key of ['target', 'result_type']) {
                if (['home', 'media', 'profile', 'playlist', 'search', 'article', 'catalogue', 'contact', 'other'].includes(payload.data?.[key])) data[key] = payload.data[key];
            }
            if (['hero', 'featured', 'recommended', 'recent', 'playlist', 'sidebar', 'topbar', 'search', 'profile'].includes(payload.data?.placement)) data.placement = payload.data.placement;
        }
        const virtualPath = !config.media_id && /^\/page\/[a-zA-Z0-9_-]{1,64}$/.test(payload.url || '') ? payload.url : null;
        // An in-place route view is a different screen, so the server page's names and tag do not apply.
        const isPageContext = !privatePath && !mediaId && !virtualPath;
        const playlistId = isPageContext && /^[0-9a-f-]{36}$/.test(config.playlist_id || '') ? config.playlist_id : null;
        if (playlistId) data.playlist_id = playlistId;
        if (playlistId && namedPageTitle) data.playlist_title = namedPageTitle;
        if (isPageContext && profileUsername) data.profile_username = profileUsername;
        if (privacy.audienceGroup && !privatePath && data.context !== 'workflow') data.audience_group = privacy.audienceGroup;
        const isLandingView = !payload.name && !privacy.nonpublic && campaignQuery && payload.url === config.path + campaignQuery;
        return {
            ...page,
            url: privatePath ? `/page/${privatePath}` : interactionPath || virtualPath || (isLandingView ? payload.url : config.path),
            title: viewedPage?.title || (mediaId ? 'Media' : isPageContext && namedPageTitle || 'Page'),
            referrer: privatePath || ['playlist', 'workflow'].includes(data.context) ? '' : sendableReferrer(privacy.referrer),
            ...(mediaId ? { tag: `${data.context === 'workflow' ? 'workflow' : 'media'}:${mediaId}` } : {}),
            ...(playlistId ? { tag: `playlist:${playlistId}` } : {}),
            ...(payload.name ? { name: payload.name, data } : Object.keys(data).length ? { data } : {}),
        };
    };

    function send(name, data = {}, media = null) {
        if (!eventName.test(name) || hasDoNotTrack()) return;
        if (!config.url || !config.website_id) return;
        // Fixed now: events wait for Umami to load, and a playlist can move to
        // its next item in place before then.
        const mediaId = media?.id || config.media_id;
        const heroTitle = media?.context === 'hero' && media.state === 'public' ? mediaTitle(media.title) : null;
        if (heroTitle) heroTitles.set(media.id, heroTitle);
        const event = {
            name,
            tag: mediaId ? `media:${mediaId}` : tag,
            url: media ? ({ hero: '/media/hero', playlist: '/media/playlist', workflow: '/media/workflow' }[media.context] || config.path) : config.path,
            title: mediaId ? 'Media' : 'Page',
            referrer,
            data: {
                ...(mediaId ? { media_id: mediaId, media_type: media?.type || config.media_type, context: media?.context || config.context, revision: media?.revision || config.revision } : {}),
                ...data,
            },
        };
        const track = () => emitUmami(event);
        if (!window.umami) {
            pending.push(track);
            return;
        }
        track();
    }

    function pageview(name) {
        if (config.media_id || !routeName.test(name) || hasDoNotTrack()) return;
        if (!config.url || !config.website_id) return;
        const previousPath = advancePath(`/page/${name}`);
        const track = () => {
            const payload = {
                website: config.website_id, url: `/page/${name}`, title: 'Page', referrer,
                data: previousPath ? { previous_path: previousPath } : {},
            };
            emitUmami(payload);
            if (audienceGroup) emitUmami({ ...payload, name: 'page_view' });
        };
        if (!window.umami) {
            pending.push(track);
            return;
        }
        track();
    }

    function currentPageview(previousPath) {
        return {
            website: config.website_id, url: config.path, title: config.media_id ? 'Media' : 'Page', referrer,
            tag: config.media_id ? `media:${config.media_id}` : tag,
            data: {
                ...(config.media_id ? { media_type: config.media_type, context: config.context, revision: config.revision } : {}),
                ...(previousPath ? { previous_path: previousPath } : {}),
            },
        };
    }

    // A playlist item played in place counts like a navigation to its page.
    function switchMedia(media) {
        if (!config.media_id || !media?.id) return;
        config.media_id = media.id;
        config.media_type = media.type;
        config.nonpublic = media.state !== 'public';
        config.title = media.title;
        config.revision = media.revision;
        config.measurement_token = media.measurement_token || null;
        audienceGroup = audienceFor(media.audience_group);
        referrer = config.nonpublic ? '' : `${window.location.protocol}//${window.location.hostname}/`;
        rememberMediaPage();
        window.CinemataAnalytics.mediaId = media.id;
        const previousPath = advancePath(config.path);
        if (config.url && config.website_id && !hasDoNotTrack()) {
            const view = currentPageview(previousPath);
            if (window.umami) emitUmami(view);
            else pending.push(() => emitUmami(view));
        }
        if (audienceGroup) send('page_view', { previous_path: previousPath });
        send('media_view', referrer ? { source_domain: new URL(referrer).hostname } : {});
    }

    function trackEvents(events) {
        if (!Array.isArray(events)) return;
        for (const event of events.slice(0, 100)) {
            if (event && typeof event.name === 'string') send(event.name, {}, event.media || null);
        }
    }

    const uploads = new Map();
    function uploadEvent(action, id) {
        if (!['start', 'complete', 'error', 'cancel', 'pause', 'resume', 'retry', 'discard'].includes(action)) return;
        if (action === 'error' && id == null) { send('upload_error'); return; }
        if (uploads.get(id) === action) return;
        if (['complete', 'error'].includes(action) && uploads.get(id) === 'complete') return;
        uploads.set(id, action);
        send(`upload_${action}`);
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
                            const day = date.toISOString().slice(0, 16) + 'Z';
                            const nextMinute = (Math.floor(cursor / 60000) + 1) * 60000;
                            const next = Math.min(endEpoch, nextMinute);
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

        // The player reloads its source for a quality change; its own pause,
        // seek and resume between these events are not viewer actions.
        let switchingSource = false;
        player.on('sourceswitchstart', () => { switchingSource = true; lastSample = null; });
        player.on('sourceswitchend', () => { switchingSource = false; lastSample = null; });

        player.on('play', () => {
            if (switchingSource) return;
            track('play');
            if (!started) {
                playInitiation = initiation();
                track('playback_start', { initiation: playInitiation });
                started = true;
                sample();
            }
        });
        player.on('pause', () => {
            if (switchingSource) return;
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
        player.on('timeupdate', () => { if (!switchingSource) sample(); });
        player.on('seeking', () => {
            lastSample = null;
            if (!switchingSource) track('seek');
        });
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
        track: send, trackEvents, uploadEvent, pageview, attachPlayer, switchMedia, mediaId: config.media_id || null,
        markNavigationIntent: () => {
            try { sessionStorage.setItem('cinemata-media-intent', JSON.stringify({ url: 'next', time: Date.now() })); }
            catch { /* Storage may be unavailable. */ }
        },
    };

    if (audienceGroup) send('page_view', { previous_path: landingPreviousPath });
    if (config.media_id) send('media_view', referrer ? { source_domain: new URL(referrer).hostname } : {});
    trackEvents(config.events);

    const firstPageview = { ...currentPageview(landingPreviousPath), url: config.path + campaignQuery };

    // Umami's recorder sends location.href with heatmap and replay data and has no
    // beforeSend hook, so it runs only where the browser URL holds nothing private.
    function recorderUrlIsSafe() {
        // Profile URLs carry the username, which page views replace with /user/profile.
        const isProfileUrl = /^\/user\//.test(window.location.pathname);
        if (config.nonpublic || window.location.hash || isProfileUrl) return false;
        return [...new URLSearchParams(window.location.search)].every(([key, value]) =>
            key === 'm' || (/^utm_(source|medium|campaign|content|term)$/.test(key) && campaignValue.test(value)));
    }

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
        script.dataset.performance = 'true';
        if (identity) script.dataset.distinctId = identity.id;
        script.onload = () => {
            if (hasDoNotTrack()) return;
            emitUmami(firstPageview);
            while (pending.length) pending.shift()();
            // Heatmaps and replays; the recorder waits for the session Umami opens above.
            if (!recorderUrlIsSafe()) return;
            const recorder = document.createElement('script');
            recorder.src = `${config.url}/recorder.js`;
            recorder.async = true;
            recorder.dataset.websiteId = config.website_id;
            recorder.dataset.hostUrl = config.url;
            document.head.append(recorder);
        };
        document.head.append(script);
    }

    document.addEventListener('click', (event) => {
        const action = event.target instanceof Element ? event.target.closest('[data-analytics-action]') : null;
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (action && !link && action.matches('button, [role="button"]')) send(action.dataset.analyticsAction);
        if (!link) return;
        if (event.defaultPrevented && !action) return;
        if (link.getAttribute('href')?.startsWith('#') && !action) return;
        let destination;
        try { destination = new URL(link.href, window.location.href); } catch { return; }
        const actionData = action?.dataset.analyticsNetwork ? { network: action.dataset.analyticsNetwork } : {};
        if (link.hasAttribute('download')) send('download_click', { file: link.dataset.analyticsFile });
        if (action && !destination.protocol.startsWith('http')) send(action.dataset.analyticsAction, actionData);
        if (destination.origin === window.location.origin) {
            const path = destination.pathname;
            const target = path === '/' ? 'home' : /^\/(view|embed|media)(\/|$)/.test(path) ? 'media' : /^\/playlists?\//.test(path) ? 'playlist' : /^\/user\//.test(path) ? 'profile' : path === '/search' ? 'search' : /^\/(latest|featured|recommended|popular|categories|tags|topics|countries|languages|members)(\/|$)/.test(path) ? 'catalogue' : path === '/contact' ? 'contact' : path.startsWith('/p/') ? 'article' : 'other';
            const placement = link.closest('.feat-first-item') ? 'hero' : link.closest('[data-analytics-placement]')?.dataset.analyticsPlacement;
            // On the home page only links inside a content section are section clicks; the menus are navigation.
            const name = /^\/accounts\/signup\/?$/.test(path) ? 'signup_click' : /^\/accounts\/login\/?$/.test(path) ? 'signin_click' : action?.dataset.analyticsAction || (config.path === '/' ? target === 'media' ? 'home_media_click' : placement ? 'home_section_click' : 'navigation_click' : config.media_id ? target === 'media' ? 'media_related_click' : target === 'profile' ? 'media_author_click' : ['search', 'catalogue'].includes(target) ? 'media_taxonomy_click' : 'navigation_click' : config.path?.startsWith('/user/profile') && target === 'profile' ? 'profile_tab_click' : config.path === '/search' ? 'search_result_click' : config.text_page ? 'article_link_click' : 'navigation_click');
            if (!link.hasAttribute('download')) send(name, { target, placement, ...(name === 'search_result_click' ? { result_type: target } : {}) });
            try {
                sessionStorage.setItem('cinemata-media-intent', JSON.stringify({
                    url: destination.href.split('#')[0], time: Date.now(),
                }));
            } catch { /* Storage may be unavailable. */ }
        }
        if (destination.protocol.startsWith('http') && destination.hostname !== window.location.hostname) {
            if (action) send(action.dataset.analyticsAction, actionData);
            send('outbound_click', { destination: destination.hostname });
        }
    });
})();
