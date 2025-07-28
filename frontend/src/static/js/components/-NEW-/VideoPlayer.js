import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import urlParse from 'url-parse';
import videojs from 'video.js';

// Import the CSS only
import '@mediacms/media-player/dist/mediacms-media-player.css';
// Import the JS file for side effects (it will define a global)
import '@mediacms/media-player/dist/mediacms-media-player.js';

import '../styles/VideoPlayer.scss';

// Device tier detection utilities
function isDeviceDetectionReliable() {
    // Check if we have access to the key APIs for reliable detection
    // navigator.deviceMemory: Only ~77% support (Chrome/Edge/Opera only, no Firefox/Safari)
    // navigator.hardwareConcurrency: Better support but still not universal
    return !!(navigator.deviceMemory && navigator.hardwareConcurrency);
}

function getDeviceTier() {
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    const deviceMemory = navigator.deviceMemory || 2; // GB
    const screenWidth = screen.width || 1024;

    // If detection is not reliable, default to conservative 'mid' tier
    if (!isDeviceDetectionReliable()) {
        return 'mid';
    }

    // Low-tier device detection
    if (hardwareConcurrency <= 2 || deviceMemory <= 2 || screenWidth <= 768) {
        return 'low';
    }

    // High-tier device detection
    if (hardwareConcurrency >= 8 || deviceMemory >= 8 || screenWidth >= 1920) {
        return 'high';
    }

    // Default to mid-tier
    return 'mid';
}

function getEstimatedBandwidth(deviceTier) {
    const bandwidthMap = {
        low: 1_000_000,     // 1 Mbps
        mid: 3_000_000,   // 3 Mbps
        high: null        // No bandwidth limitation
    };

    return bandwidthMap[deviceTier] || bandwidthMap.mid;
}

export function formatInnerLink(url, baseUrl) {
    let link = urlParse(url, {});

    if ('' === link.origin || 'null' === link.origin || !link.origin) {
        link = urlParse(baseUrl + '/' + url.replace(/^\//g, ''), {});
    }

    return link.toString();
}

export function VideoPlayerError(props) {
    return (
        <div className="error-container">
            <div className="error-container-inner">
                <span className="icon-wrap">
                    <i className="material-icons">error_outline</i>
                </span>
                <span className="msg-wrap">{props.errorMessage}</span>
            </div>
        </div>
    );
}

VideoPlayerError.propTypes = {
    errorMessage: PropTypes.string.isRequired,
};

export function VideoPlayer(props) {
    const videoElemRef = useRef(null);

    let player = null;

    // Device tier detection and bandwidth estimation
    const deviceDetectionReliable = isDeviceDetectionReliable();
    const deviceTier = props.forceTier || getDeviceTier();
    const estimatedBandwidth = getEstimatedBandwidth(deviceTier);

    // Debug logging if enabled
    if (props.debug) {
        console.log('VideoPlayer Debug Info:', {
            deviceDetectionReliable,
            deviceTier,
            estimatedBandwidth,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            screenWidth: screen.width,
            browserSupport: {
                deviceMemory: !!navigator.deviceMemory,
                hardwareConcurrency: !!navigator.hardwareConcurrency,
            }
        });

        // Export for analytics/debugging
        if (typeof window !== 'undefined') {
            window.deviceTier = deviceTier;
            window.deviceDetectionReliable = deviceDetectionReliable;
        }
    }

    const playerStates = {
        playerVolume: props.playerVolume,
        playerSoundMuted: props.playerSoundMuted,
        videoQuality: props.videoQuality,
        videoPlaybackSpeed: props.videoPlaybackSpeed,
        inTheaterMode: props.inTheaterMode,
    };

    playerStates.playerVolume =
        null === playerStates.playerVolume ? 1 : Math.max(Math.min(Number(playerStates.playerVolume), 1), 0);
    playerStates.playerSoundMuted = null !== playerStates.playerSoundMuted ? playerStates.playerSoundMuted : !1;
    playerStates.videoQuality = null !== playerStates.videoQuality ? playerStates.videoQuality : 'Auto';
    playerStates.videoPlaybackSpeed = null !== playerStates.videoPlaybackSpeed ? playerStates.videoPlaybackSpeed : !1;
    playerStates.inTheaterMode = null !== playerStates.inTheaterMode ? playerStates.inTheaterMode : !1;

    function onClickNext() {
        if (void 0 !== props.onClickNextCallback) {
            props.onClickNextCallback();
        }
    }

    function onClickPrevious() {
        if (void 0 !== props.onClickPreviousCallback) {
            props.onClickPreviousCallback();
        }
    }

    function onPlayerStateUpdate(newState) {
        if (playerStates.playerVolume !== newState.volume) {
            playerStates.playerVolume = newState.volume;
        }

        if (playerStates.playerSoundMuted !== newState.soundMuted) {
            playerStates.playerSoundMuted = newState.soundMuted;
        }

        if (playerStates.videoQuality !== newState.quality) {
            playerStates.videoQuality = newState.quality;
        }

        if (playerStates.videoPlaybackSpeed !== newState.playbackSpeed) {
            playerStates.videoPlaybackSpeed = newState.playbackSpeed;
        }

        if (playerStates.inTheaterMode !== newState.theaterMode) {
            playerStates.inTheaterMode = newState.theaterMode;
        }

        if (void 0 !== props.onStateUpdateCallback) {
            props.onStateUpdateCallback(newState);
        }
    }

    function initPlayer() {
        if (null !== player || null !== props.errorMessage) {
            return;
        }

        if (!props.inEmbed) {
            window.removeEventListener('focus', initPlayer);
            document.removeEventListener('visibilitychange', initPlayer);
        }

        if (!videoElemRef.current) {
            return;
        }

        if (!props.inEmbed) {
            videoElemRef.current.focus(); // Focus on player before instance init.
        }

        const subtitles = {
            on: false,
        };

        if (void 0 !== props.subtitlesInfo && null !== props.subtitlesInfo && props.subtitlesInfo.length) {
            subtitles.languages = [];

            let i = 0;
            while (i < props.subtitlesInfo.length) {
                if (
                    void 0 !== props.subtitlesInfo[i].src &&
                    void 0 !== props.subtitlesInfo[i].srclang &&
                    void 0 !== props.subtitlesInfo[i].label
                ) {
                    subtitles.languages.push({
                        src: formatInnerLink(props.subtitlesInfo[i].src, props.siteUrl),
                        srclang: props.subtitlesInfo[i].srclang,
                        label: props.subtitlesInfo[i].label,
                    });
                }

                i += 1;
            }

            if (subtitles.languages.length) {
                subtitles.on = true;
            }
        }

        // Get MediaPlayer from the global object
        const MediaPlayerClass = window['@mediacms/media-player'];

        // Enhanced player options with VHS bandwidth hinting and anti-buffering configuration
        const playerOptions = {
            enabledTouchControls: true,
            sources: props.sources,
            poster: props.poster,
            autoplay: props.enableAutoplay,
            // Prevent buffering until user interaction (unless autoplay is enabled)
            preload: props.enableAutoplay ? 'metadata' : 'none',
            bigPlayButton: true,
            controlBar: {
                theaterMode: props.hasTheaterMode,
                pictureInPicture: false,
                next: props.hasNextLink ? true : false,
                previous: props.hasPreviousLink ? true : false,
            },
            subtitles: subtitles,
            cornerLayers: props.cornerLayers,
            videoPreviewThumb: props.previewSprite,

            vhsOptions: {
                ...(estimatedBandwidth !== null && { bandwidth: estimatedBandwidth }),
                useBandwidthFromLocalStorage: false,
                // Force conservative startup for all devices to prevent buffering
                enableLowInitialPlaylist: true,
                limitRenditionByPlayerDimensions: true,
                useDevicePixelRatio: true,
                // Modern VHS options for better performance and reduced buffering
                handlePartialData: true,
                // Enable Network Information API for high-tier devices only
                useNetworkInformationApi: deviceTier === 'high',
                maxPlaylistRetries: 2,
                playlistExclusionDuration: 60
            }
        };

        if (props.debug) {
            console.log('VideoPlayer Configuration:', {
                deviceTier,
                estimatedBandwidth,
                preloadStrategy: props.enableAutoplay ? 'metadata' : 'none',
                antiBufferingMode: true,
                enableLowInitialPlaylist: true,
                note: deviceDetectionReliable
                    ? 'Device detection reliable: using estimated bandwidth with anti-buffering configuration'
                    : 'Device detection unreliable (Firefox/Safari): conservative startup with anti-buffering enabled',
                antiBufferingExplanation: {
                    preload: props.enableAutoplay ? 'metadata only (autoplay enabled)' : 'none (prevents startup buffering)',
                    enableLowInitialPlaylist: 'forced true (starts with lowest quality)',
                    handlePartialData: 'enabled (allows partial segment rendering for faster startup)',
                    useNetworkInformationApi: deviceTier === 'high'
                        ? 'enabled (high-tier devices can benefit from real-time network data)'
                        : 'disabled (conflicts with bandwidth limits for low/mid devices)',
                    maxPlaylistRetries: '2 (quick failover)',
                    playlistExclusionDuration: '60 seconds (faster recovery)'
                },
                playerOptions
            });
        }

        player = new MediaPlayerClass(
            videoElemRef.current,
            playerOptions,
            {
                volume: playerStates.playerVolume,
                soundMuted: playerStates.playerSoundMuted,
                theaterMode: playerStates.inTheaterMode,
                theSelectedQuality: void 0, // @note: Allow auto resolution selection by sources order.
                theSelectedPlaybackSpeed: playerStates.videoPlaybackSpeed || 1,
            },
            props.info,
            [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
            onPlayerStateUpdate,
            onClickNext,
            onClickPrevious
        );

        if (void 0 !== props.onPlayerInitCallback) {
            props.onPlayerInitCallback(player, videoElemRef.current);
        }
    }

    function unsetPlayer() {
        if (null === player) {
            return;
        }
        videojs(videoElemRef.current).dispose();
        player = null;
    }

    useEffect(() => {
        if (props.inEmbed || document.hasFocus() || 'visible' === document.visibilityState) {
            initPlayer();
        } else {
            window.addEventListener('focus', initPlayer);
            document.addEventListener('visibilitychange', initPlayer);
        }

        /*
                // We don't need this because we have a custom function in frontend/src/static/js/components/media-viewer/VideoViewer/index.js:617
                player && player.player.one('loadedmetadata', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const paramT = Number(urlParams.get('t'));
                const timestamp = !isNaN(paramT) ? paramT : 0;
                player.player.currentTime(timestamp);
        }); */

        return () => {
            unsetPlayer();

            if (void 0 !== props.onUnmountCallback) {
                props.onUnmountCallback();
            }
        };
    }, []);

    return null === props.errorMessage ? (
        <video ref={videoElemRef} className="video-js vjs-mediacms native-dimensions"></video>
    ) : (
        <div className="error-container">
            <div className="error-container-inner">
                <span className="icon-wrap">
                    <i className="material-icons">error_outline</i>
                </span>
                <span className="msg-wrap">{props.errorMessage}</span>
            </div>
        </div>
    );
}

VideoPlayer.propTypes = {
    playerVolume: PropTypes.string,
    playerSoundMuted: PropTypes.bool,
    videoQuality: PropTypes.string,
    videoPlaybackSpeed: PropTypes.number,
    inTheaterMode: PropTypes.bool,
    siteId: PropTypes.string.isRequired,
    siteUrl: PropTypes.string.isRequired,
    errorMessage: PropTypes.string,
    cornerLayers: PropTypes.object,
    subtitlesInfo: PropTypes.array.isRequired,
    inEmbed: PropTypes.bool.isRequired,
    sources: PropTypes.array.isRequired,
    info: PropTypes.object.isRequired,
    enableAutoplay: PropTypes.bool.isRequired,
    hasTheaterMode: PropTypes.bool.isRequired,
    hasNextLink: PropTypes.bool.isRequired,
    hasPreviousLink: PropTypes.bool.isRequired,
    poster: PropTypes.string,
    previewSprite: PropTypes.object,
    onClickPreviousCallback: PropTypes.func,
    onClickNextCallback: PropTypes.func,
    onPlayerInitCallback: PropTypes.func,
    onStateUpdateCallback: PropTypes.func,
    onUnmountCallback: PropTypes.func,
    // New props for device tier detection, debugging, and anti-buffering
    debug: PropTypes.bool,
    forceTier: PropTypes.oneOf(['low', 'mid', 'high']),
    enableLowInitialPlaylist: PropTypes.bool, // Note: Always forced to true for anti-buffering
};

VideoPlayer.defaultProps = {
    errorMessage: null,
    cornerLayers: {},
};
