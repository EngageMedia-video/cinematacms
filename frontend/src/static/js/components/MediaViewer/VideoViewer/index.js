import React from "react";

import PropTypes from "prop-types";

import PageStore from "../../../pages/_PageStore.js";

import MediaPageStore from "../../../pages/MediaPage/store.js";

import VideoPlayerStore from "./store.js";
import * as VideoPlayerActions from "./actions.js";

import {
	orderedSupportedVideoFormats,
	videoAvailableCodecsAndResolutions,
	extractDefaultVideoResolution,
} from "./functions";
import { addClassname, removeClassname } from "../../../functions/dom.js";

import { addPageMetadata } from "../../../functions";

import { formatInnerLink, formatMediaLink } from "../../../functions/formatInnerLink";

import UpNextLoaderView from "../../../classes/UpNextLoaderView";
import PlayerRecommendedMedia from "../../../classes/PlayerRecommendedMedia";

import MediaDurationInfo from "../../../classes/MediaDurationInfo";
import BrowserCache from "../../../classes/BrowserCache.js";

import SiteContext, { SiteConsumer } from "../../../contexts/SiteContext";

import { VideoPlayer, VideoPlayerError } from "../../-NEW-/VideoPlayer.js";

import "../../styles/VideoViewer.scss";


function filterVideoEncoding(encoding_status) {
	switch (encoding_status) {
		case 'running':
			MediaPageStore.set('media-load-error-type', 'encodingRunning');
			MediaPageStore.set('media-load-error-message', 'Media encoding is currently running. Try again in few minutes.');
			break;
		case 'pending':
			MediaPageStore.set('media-load-error-type', 'encodingPending');
			MediaPageStore.set('media-load-error-message', 'Media encoding is pending');
			break;
		case 'fail':
			MediaPageStore.set('media-load-error-type', 'encodingFailed');
			MediaPageStore.set('media-load-error-message', 'Media encoding failed');
			break;
	}
}

export default class VideoViewer extends React.PureComponent {
	constructor(props) {
		super(props);

		this.state = {
			displayPlayer: false,
		};

		this.videoSources = [];

		filterVideoEncoding(this.props.data.encoding_status);

		if (null !== MediaPageStore.get('media-load-error-type')) {
			this.state.displayPlayer = true;
			return;
		}

		if ('string' === typeof this.props.data.poster_url) {
			this.videoPoster = formatInnerLink(this.props.data.poster_url, this.props.siteUrl);
		} else if ('string' === typeof this.props.data.thumbnail_url) {
			this.videoPoster = formatInnerLink(this.props.data.thumbnail_url, this.props.siteUrl);
		}

		this.videoInfo = videoAvailableCodecsAndResolutions(this.props.data.encodings_info, this.props.data.hls_info);

		if (this.props.debug) {
			console.log('VIDEO DEBUG: encodings_info:', this.props.data.encodings_info);
			console.log('VIDEO DEBUG: hls_info:', this.props.data.hls_info);
			console.log('VIDEO DEBUG: videoInfo:', this.videoInfo);
		}

		const resolutionsKeys = Object.keys(this.videoInfo);

		if (!resolutionsKeys.length) {
			this.videoInfo = null;
		} else {
			let defaultResolution = VideoPlayerStore.get('video-quality');

			if (null === defaultResolution || ('Auto' === defaultResolution && void 0 === this.videoInfo['Auto'])) {
				defaultResolution = 720; // Default resolution.
			}

			let defaultVideoResolution = extractDefaultVideoResolution(defaultResolution, this.videoInfo);

			if ('Auto' === defaultResolution && void 0 !== this.videoInfo['Auto']) {
				const password = (typeof MediaCMS !== 'undefined' && MediaCMS.provided_password) ? MediaCMS.provided_password : null;
				const srcUrl = formatMediaLink(this.videoInfo['Auto'].url[0], this.props.siteUrl, password);
				this.videoSources.push({ src: srcUrl });
			}

			const supportedFormats = orderedSupportedVideoFormats();

			let srcUrl, k;

			k = 0;
			while (k < this.videoInfo[defaultVideoResolution].format.length) {
				if ('hls' === this.videoInfo[defaultVideoResolution].format[k]) {
					const password = (typeof MediaCMS !== 'undefined' && MediaCMS.provided_password) ? MediaCMS.provided_password : null;
					const srcUrl = formatMediaLink(this.videoInfo[defaultVideoResolution].url[k], this.props.siteUrl, password);
					this.videoSources.push({ src: srcUrl });
					break;
				}
				k += 1;
			}

			for (k in this.props.data.encodings_info[defaultVideoResolution]) {
				if (this.props.data.encodings_info[defaultVideoResolution].hasOwnProperty(k)) {
					if (supportedFormats.support[k]) {
						srcUrl = this.props.data.encodings_info[defaultVideoResolution][k].url;

						if (!!srcUrl) {
							const password = (typeof MediaCMS !== 'undefined' && MediaCMS.provided_password) ? MediaCMS.provided_password : null;
							srcUrl = formatMediaLink(srcUrl, this.props.siteUrl, password);

							this.videoSources.push({
								src: srcUrl /*.replace("http://", "//").replace("https://", "//")*/,
								encodings_status: this.props.data.encodings_info[defaultVideoResolution][k].status,
							});
						}
					}
				}
			}

			// console.log( supportedFormats );
			// console.log( this.videoInfo );
			// console.log( defaultVideoResolution );
			// console.log( this.videoSources );

			if (this.props.debug) {
				console.log('VIDEO DEBUG: supportedFormats:', supportedFormats);
				console.log('VIDEO DEBUG: videoInfo:', this.videoInfo);
				console.log('VIDEO DEBUG: defaultVideoResolution:', defaultVideoResolution);
				console.log('VIDEO DEBUG: videoSources:', this.videoSources);
			}
		}

		if (this.videoSources.length) {
			if (
				!this.props.inEmbed &&
				1 === this.videoSources.length &&
				'running' === this.videoSources[0].encodings_status
			) {
				MediaPageStore.set('media-load-error-type', 'encodingRunning');
				MediaPageStore.set(
					'media-load-error-message',
					'Media encoding is currently running. Try again in few minutes.'
				);
				return;
			}
			addPageMetadata({
				videoUrl: formatInnerLink(
					this.videoSources[this.videoSources.length - 1].src,
					this.props.siteUrl
				),
				videoDuration: this.props.data.duration,
			});
		} else {
			switch (MediaPageStore.get('media-load-error-type')) {
				case 'encodingRunning':
				case 'encodingPending':
				case 'encodingFailed':
					break;
				default:
					if (this.props.debug) {
						console.warn('VIDEO DEBUG:', "Video files don't exist");
						console.warn('VIDEO DEBUG: Available encodings_info keys:', Object.keys(this.props.data.encodings_info || {}));
						console.warn('VIDEO DEBUG: Available hls_info keys:', Object.keys(this.props.data.hls_info || {}));
						console.warn('VIDEO DEBUG: videoInfo:', this.videoInfo);
					}
			}
		}

		PageStore.on('switched_media_auto_play', this.onUpdateMediaAutoPlay.bind(this));

		this.browserCache = new BrowserCache(SiteContext._currentValue.id, 86400); // Keep cache data "fresh" for one day.

		const _MediaDurationInfo = new MediaDurationInfo();

		_MediaDurationInfo.update(this.props.data.duration);

		this.durationISO8601 = _MediaDurationInfo.ISO8601();

		this.playerElem = null;

		this.playerInstance = null;

		this.onPlayerInit = this.onPlayerInit.bind(this);

		this.onClickNext = this.onClickNext.bind(this);
		this.onClickPrevious = this.onClickPrevious.bind(this);
		this.onStateUpdate = this.onStateUpdate.bind(this);

		this.onVideoEnd = this.onVideoEnd.bind(this);
		this.onVideoRestart = this.onVideoRestart.bind(this);
	}

	componentDidMount() {
		if (this.videoSources.length) {
			this.recommendedMedia = this.props.data.related_media.length
				? new PlayerRecommendedMedia(
					this.props.data.related_media,
					this.props.inEmbed,
					!PageStore.get('config-media-item').displayViews
				)
				: null;

			this.upNextLoaderView =
				!this.props.inEmbed && this.props.data.related_media.length
					? new UpNextLoaderView(this.props.data.related_media[0])
					: null;

			let topLeftHtml = null;

			if (this.props.inEmbed) {
				let titleLink = document.createElement('a');
				let userThumbLink = document.createElement('a');

				topLeftHtml = document.createElement('div');
				topLeftHtml.setAttribute('class', 'media-links-top-left');

				if (titleLink) {
					titleLink.setAttribute('class', 'title-link');
					titleLink.setAttribute('href', this.props.data.url);
					titleLink.setAttribute('title', this.props.data.title);
					titleLink.setAttribute('target', '_blank');
					titleLink.innerHTML = this.props.data.title;
				}

				if (userThumbLink) {
					userThumbLink.setAttribute('class', 'user-thumb-link');
					userThumbLink.setAttribute('href', formatInnerLink(this.props.data.author_profile, this.props.siteUrl));
					userThumbLink.setAttribute('title', this.props.data.author_name);
					userThumbLink.setAttribute('target', '_blank');
					userThumbLink.setAttribute(
						'style',
						'background-image:url(' +
						formatInnerLink(MediaPageStore.get('media-author-thumbnail-url'), this.props.siteUrl) +
						')'
					);
				}

				topLeftHtml.appendChild(userThumbLink);
				topLeftHtml.appendChild(titleLink);
			}

			const mediaUrl = MediaPageStore.get('media-url');

			let bottomRightHTML =
				'<button class="share-video-btn"><i class="material-icons">share</i><span>Share</span></button>';
			bottomRightHTML +=
				'<div class="share-options-wrapper">\
									<div class="share-options">\
										<div class="share-options-inner">\
											<div class="sh-option share-email">\
												<a href="mailto:?body=' +
				mediaUrl +
				'" title=""><span><i class="material-icons">email</i></span><span>Email</span></a>\
											</div>\
											<div class="sh-option share-fb">\
												<a href="https://www.facebook.com/sharer.php?u=' +
				mediaUrl +
				'" title="" target="_blank"><span></span><span>Facebook</span></a>\
											</div>\
											<div class="sh-option share-tw">\
												<a href="https://twitter.com/intent/tweet?url=' +
				mediaUrl +
				'" title="" target="_blank"><span></span><span>Twitter</span></a>\
											</div>\
											<div class="sh-option share-whatsapp">\
												<a href="whatsapp://send?text=' +
				mediaUrl +
				'" title="" target="_blank" data-action="share/whatsapp/share"><span></span><span>WhatsApp</span></a>\
											</div>\
											<div class="sh-option share-telegram">\
												<a href="https://t.me/share/url?url=' +
				mediaUrl +
				'&amp;text=' +
				this.props.data.title +
				'" title="" target="_blank"><span></span><span>Telegram</span></a>\
											</div>\
											<div class="sh-option share-linkedin">\
													<a href="https://www.linkedin.com/shareArticle?mini=true&amp;url=' +
				mediaUrl +
				'" title="" target="_blank"><span></span><span>LinkedIn</span></a>\
											</div>\
											<div class="sh-option share-reddit">\
												<a href="https://reddit.com/submit?url=' +
				mediaUrl +
				'&amp;title=' +
				this.props.data.title +
				'" title="" target="_blank"><span></span><span>reddit</span></a>\
											</div>\
											<div class="sh-option share-tumblr">\
												<a href="https://www.tumblr.com/widgets/share/tool?canonicalUrl=' +
				mediaUrl +
				'&amp;title=' +
				this.props.data.title +
				'" title="" target="_blank"><span></span><span>Tumblr</span></a>\
											</div>\
											<div class="sh-option share-pinterest">\
												<a href="http://pinterest.com/pin/create/link/?url=' +
				mediaUrl +
				'" title="" target="_blank"><span></span><span>Pinterest</span></a>\
											</div>\
											<div class="sh-option share-more">\
												<a href="' +
				mediaUrl +
				'" title="More" target="_blank"><span><i class="material-icons">more_horiz</i></span><span></span></a>\
											</div>\
										</div>\
									</div>\
								</div>';

			this.cornerLayers = {
				topLeft: topLeftHtml,
				topRight: this.upNextLoaderView ? this.upNextLoaderView.html() : null,
				bottomLeft: this.recommendedMedia ? this.recommendedMedia.html() : null,
				bottomRight: this.props.inEmbed ? bottomRightHTML : null,
			};

			this.setState(
				{
					displayPlayer: true,
				},
				function () {
					setTimeout(function () {
						const shareBtn = document.querySelector('.share-video-btn');
						const shareWrap = document.querySelector('.share-options-wrapper');
						const shareInner = document.querySelector('.share-options-inner');
						if (shareBtn) {
							shareBtn.addEventListener('click', function (ev) {
								addClassname(document.querySelector('.video-js.vjs-mediacms'), 'vjs-visible-share-options');
							});
						}
						if (shareWrap) {
							shareWrap.addEventListener('click', function (ev) {
								if (ev.target === shareInner || ev.target === shareWrap) {
									removeClassname(document.querySelector('.video-js.vjs-mediacms'), 'vjs-visible-share-options');
								}
							});
						}
					}, 1000);
				}
			);
		}
	}

	componentWillUnmount() {
		this.unsetRecommendedMedia();
	}

	initRecommendedMedia() {
		if (null === this.recommendedMedia) {
			return;
		}

		if (!this.props.inEmbed) {
			this.recommendedMedia.init();
		}

		this.playerInstance.player.on('fullscreenchange', this.recommendedMedia.onResize);

		PageStore.on('window_resize', this.recommendedMedia.onResize);

		VideoPlayerStore.on('changed_viewer_mode', this.recommendedMedia.onResize);
	}

	unsetRecommendedMedia() {
		if (null === this.recommendedMedia) {
			return;
		}
		this.playerInstance.player.off('fullscreenchange', this.recommendedMedia.onResize);
		PageStore.removeListener('window_resize', this.recommendedMedia.onResize);
		VideoPlayerStore.removeListener('changed_viewer_mode', this.recommendedMedia.onResize);
		this.recommendedMedia.destroy();
	}

	onClickNext() {
		const playlistId = MediaPageStore.get('playlist-id');

		let nextLink;

		if (playlistId) {
			nextLink = MediaPageStore.get('playlist-next-media-url');

			if (null === nextLink) {
				nextLink = this.props.data.related_media[0].url;
			}
		} else if (!this.props.inEmbed) {
			nextLink = this.props.data.related_media[0].url;
		}

		window.location.href = nextLink;
	}

	onClickPrevious() {
		const playlistId = MediaPageStore.get('playlist-id');

		let previousLink;

		if (playlistId) {
			previousLink = MediaPageStore.get('playlist-previous-media-url');

			if (null === previousLink) {
				previousLink = this.props.data.related_media[0].url;
			}
		} else if (!this.props.inEmbed) {
			previousLink = this.props.data.related_media[0].url;
		}

		window.location.href = previousLink;
	}

	onStateUpdate(newState) {
		if (VideoPlayerStore.get('in-theater-mode') !== newState.theaterMode) {
			VideoPlayerActions.set_viewer_mode(newState.theaterMode);
		}

		if (VideoPlayerStore.get('player-volume') !== newState.volume) {
			VideoPlayerActions.set_player_volume(newState.volume);
		}

		if (VideoPlayerStore.get('player-sound-muted') !== newState.soundMuted) {
			VideoPlayerActions.set_player_sound_muted(newState.soundMuted);
		}

		if (VideoPlayerStore.get('video-quality') !== newState.quality) {
			VideoPlayerActions.set_video_quality(newState.quality);
		}

		if (VideoPlayerStore.get('video-playback-speed') !== newState.playbackSpeed) {
			VideoPlayerActions.set_video_playback_speed(newState.playbackSpeed);
		}
	}

	
	onPlayerInit(instance, elem) {
		this.playerElem = elem;
		this.playerInstance = instance;

		if (this.upNextLoaderView) {
			this.upNextLoaderView.setVideoJsPlayerElem(this.playerInstance.player.el_);
			this.onUpdateMediaAutoPlay();
		}

		if (!this.props.inEmbed) {
			this.playerElem.parentNode.focus();
		}

		if (this.recommendedMedia) {
			this.recommendedMedia.initWrappers(this.playerElem.parentNode);

			if (this.props.inEmbed) {
				this.playerInstance.player.one('pause', this.recommendedMedia.init);
				this.initRecommendedMedia();
			}
		}

		// Bind ended event
		this.playerInstance.player.one('ended', this.onVideoEnd);
		// Restore fullscreen if URL param fs=1
		this.checkAndRestoreFullscreen();
	}


	checkAndRestoreFullscreen() {
		const urlParams = new URLSearchParams(window.location.search);
		const shouldRestore = urlParams.get('fs') === '1';

		// 🚫 Do NOT restore fullscreen or show prompt on first video
		if (shouldRestore && this.props.currentIndex === 0) {
			// Clean the URL anyway
			urlParams.delete('fs');
			const cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
			window.history.replaceState({}, document.title, cleanUrl);
			return;
		}

		if (shouldRestore) {
			// Remove fs from URL
			urlParams.delete('fs');
			const cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
			window.history.replaceState({}, document.title, cleanUrl);

			// Wait for player to fully load
			this.playerInstance.player.ready(() => {
				setTimeout(() => this.showFullscreenContinuePrompt(), 200);
			});
		}
	}


	showFullscreenContinuePrompt() {

		// Pause video until user clicks
		this.playerInstance.player.pause();
		
		// Create prompt overlay
		const prompt = document.createElement('div');
		prompt.className = 'fullscreen-continue-prompt';
		prompt.innerHTML = `
			<div class="playlist-spinner-container">
				<div class="playlist-spinner-outer"></div>
				<div class="playlist-spinner-inner"></div>
			</div>
			<h2 class="prompt-title">Continue in Fullscreen</h2>
			<p class="prompt-subtitle">Click anywhere to resume</p>
		`;
		
		document.body.appendChild(prompt);
		
		// Click handler - THIS IS THE USER GESTURE that allows fullscreen
		const clickHandler = () => {
			prompt.remove();
			
			this.requestFullscreen()
				.then(() => {
					this.playerInstance.player.play();
				})
				.catch((error) => {
					console.warn('Fullscreen request failed:', error);
					// Graceful fallback - just play video in windowed mode
					this.playerInstance.player.play();
				});
			document.removeEventListener('keydown', keyHandler);
		};
		
		prompt.addEventListener('click', clickHandler);
		// Also allow spacebar or Enter key
		const keyHandler = (e) => {
			const isSpace = e.key === ' ' || e.key === 'Space' || e.code === 'Space';
			const isEnter = e.key === 'Enter';

			if (isSpace || isEnter) {
				e.preventDefault();
				clickHandler();
			}
		};

		document.addEventListener('keydown', keyHandler);
	}


	requestFullscreen() {
		const element = this.playerInstance.player.el();
		
		
		// Try different browser APIs
		if (element.requestFullscreen) {
			return element.requestFullscreen();
		} else if (element.webkitRequestFullscreen) {
			return element.webkitRequestFullscreen();
		} else if (element.mozRequestFullScreen) {
			return element.mozRequestFullScreen();
		} else if (element.msRequestFullscreen) {
			return element.msRequestFullscreen();
		}
		
		// Fallback if no API available
		return Promise.reject(new Error('Fullscreen API not supported'));
	}

	onVideoRestart() {
		if (null !== this.recommendedMedia) {
			this.recommendedMedia.updateDisplayType('inline');

			if (this.props.inEmbed) {
				this.playerInstance.player.one('pause', this.recommendedMedia.init);
			}

			this.playerInstance.player.one('ended', this.onVideoEnd);
		}
	}


	onVideoEnd = () => {

		const playlistId = MediaPageStore.get('playlist-id');
		const isPlaylist = !!playlistId;

		if (isPlaylist) {
			  if (this.upNextLoaderView) {
				try { this.upNextLoaderView.hideTimerView(); } catch (_) {}
				try { this.playerInstance.player.off('ended', this.upNextLoaderView.startTimer); } catch (_) {}
				try { this.playerInstance.player.off('timeupdate', this.upNextLoaderView.updateTimer); } catch (_) {}
			}

			// 🚫 Disable RecommendedMedia too
			if (this.recommendedMedia) {
				try { this.recommendedMedia.updateDisplayType('hidden'); } catch (_) {}
				try { this.playerInstance.player.off('pause', this.recommendedMedia.init); } catch (_) {}
				try { this.playerInstance.player.off('playing', this.onVideoRestart); } catch (_) {}
			}

			this.recommendedMedia = null;

			let nextMedia = MediaPageStore.get('playlist-next-media');


			if (nextMedia) {
				// NORMAL CASE → Has next video
				const nextUrl = `${nextMedia.url}${playlistId ? `&pl=${playlistId}` : ''}`;
				this.showTransitionCard(nextUrl);
			} else {

				const playlistUrl = `/playlists/${playlistId}`;


				const finalUrl = playlistUrl; // no fs=1
				this.navigateWithFullscreenRestore(finalUrl, true);

			}
			return;
		}


		// -------------------------------
		// Non-playlist mode → RecommendedMedia
		// -------------------------------
		const hasRecommended = this.recommendedMedia && !this.props.inEmbed;
		if (hasRecommended) {
			this.initRecommendedMedia();
			this.recommendedMedia.updateDisplayType('full');
			this.playerInstance.player.one('playing', this.onVideoRestart);
		}

		if (this.upNextLoaderView) {
			this.upNextLoaderView.showTimerView(true);
		}
	};

	

	showTransitionCard(nextMediaUrl) {

		const nextVideoData = this.getNextVideoMetadata();
		if (!nextVideoData) {
			console.warn('⚠ No next video metadata found, aborting transition card.');
			return;
		}

		const card = this.createTransitionCard(nextVideoData);
		const playerEl = this.playerInstance.player.el();
		playerEl.appendChild(card);

		setTimeout(() => {
			card.classList.add('active');
		}, 100);

		// Hide video via CSS class (CSP-safe)
		const videoEl = playerEl.querySelector('video');
		if (videoEl) {
			videoEl.classList.add('hidden-video');
		} else {
			console.warn('⚠ No video element found to hide.');
		}

		// Navigate to next video after 3s
		setTimeout(() => {
			this.navigateWithFullscreenRestore(nextMediaUrl);
		}, 3000);
	}


	// --------------------------------------------
	// createTransitionCard
	// --------------------------------------------
	createTransitionCard(videoData) {
		const card = document.createElement('div');
		card.className = 'playlist-transition-card';
		card.innerHTML = `
			<div class="card-content">
				<div class="playlist-spinner-container">
					<div class="playlist-spinner-outer"></div>
					<div class="playlist-spinner-inner"></div>
				</div>
				<h1 class="film-title">${videoData.title}</h1>
				<div class="metadata-row">
					<span class="metadata-item">${videoData.country || 'Unknown'}</span>
					<div class="metadata-separator"></div>
					<span class="metadata-item">${videoData.year || new Date().getFullYear()}</span>
					<div class="metadata-separator"></div>
					<span class="metadata-item">${this.formatDuration(videoData.duration)}</span>
				</div>
			</div>
		`;
		return card;
	}

	// --------------------------------------------
	// navigateWithFullscreenRestore
	// --------------------------------------------
	navigateWithFullscreenRestore(nextMediaUrl, isLast = false) {
		// Only add fs=1 if NOT the last media
		if (!isLast) {
			const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
			if (isFullscreen) {
				const separator = nextMediaUrl.includes('?') ? '&' : '?';
				nextMediaUrl += `${separator}fs=1`;
			}
		}

		window.location.href = nextMediaUrl;
	}

	// Get next video metadata from playlist
	getNextVideoMetadata() {
		const nextMedia = MediaPageStore.get('playlist-next-media') 
			|| (this.props.data.related_media.length ? this.props.data.related_media[0] : null);

		if (!nextMedia) return null;

		return {
			title: nextMedia.title || 'Next Video',
			country: nextMedia.media_country_info?.[0]?.title || 'Unknown',
			year: nextMedia.year_produced || new Date().getFullYear(),
			duration: nextMedia.duration || 0,
			src: nextMedia.url
		};
	}


	// Format duration from seconds to HH:MM:SS
	formatDuration(seconds) {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		
		const pad = (num) => String(num).padStart(2, '0');
		
		if (hrs > 0) {
			return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
		}
		return `${pad(mins)}:${pad(secs)}`;
	}


	onUpdateMediaAutoPlay() {
		if (this.upNextLoaderView) {
			if (PageStore.get('media-auto-play')) {
				this.upNextLoaderView.showTimerView(this.playerInstance.isEnded());
			} else {
				this.upNextLoaderView.hideTimerView();
			}
		}
	}

	render() {
		let nextLink = null;
		let previousLink = null;

		const playlistId = this.props.inEmbed ? null : MediaPageStore.get('playlist-id');

		if (playlistId) {
			nextLink = MediaPageStore.get('playlist-next-media-url');
			previousLink = MediaPageStore.get('playlist-previous-media-url');
		} else {
			nextLink =
				this.props.data.related_media.length && !this.props.inEmbed ? this.props.data.related_media[0].url : null;
		}

		const previewSprite = !!this.props.data.sprites_url
			? {
				url: this.props.siteUrl + '/' + this.props.data.sprites_url.replace(/^\//g, ''),
				frame: { width: 160, height: 90, seconds: 10 },
			}
			: null;

		return (
			<div
				key={(this.props.inEmbed ? 'embed-' : '') + 'player-container'}
				className={'player-container' + (this.videoSources.length ? '' : ' player-container-error')}
				style={this.props.containerStyles}
				ref="playerContainer"
			>
				<div className="player-container-inner" ref="playerContainerInner" style={this.props.containerStyles}>
					{this.state.displayPlayer && null !== MediaPageStore.get('media-load-error-type') ? (
						<VideoPlayerError errorMessage={MediaPageStore.get('media-load-error-message')} />
					) : null}

					{this.state.displayPlayer && null == MediaPageStore.get('media-load-error-type') ? (
						<div className="video-player" ref="videoPlayerWrapper" key="videoPlayerWrapper">
							<SiteConsumer>
								{(site) => (
									<VideoPlayer
										playerVolume={this.browserCache.get('player-volume')}
										playerSoundMuted={this.browserCache.get('player-sound-muted')}
										videoQuality={this.browserCache.get('video-quality')}
										videoPlaybackSpeed={parseInt(this.browserCache.get('video-playback-speed'), 10)}
										inTheaterMode={this.browserCache.get('in-theater-mode')}
										siteId={site.id}
										siteUrl={site.url}
										info={this.videoInfo}
										cornerLayers={this.cornerLayers}
										sources={this.videoSources}
										poster={this.videoPoster}
										previewSprite={previewSprite}
										subtitlesInfo={this.props.data.subtitles_info}
										enableAutoplay={!this.props.inEmbed}
										inEmbed={this.props.inEmbed}
										hasTheaterMode={!this.props.inEmbed}
										hasNextLink={!!nextLink}
										hasPreviousLink={!!previousLink}
										errorMessage={MediaPageStore.get('media-load-error-message')}
										onClickNextCallback={this.onClickNext}
										onClickPreviousCallback={this.onClickPrevious}
										onStateUpdateCallback={this.onStateUpdate}
										onPlayerInitCallback={this.onPlayerInit}
										debug={false}
									/>
								)}
							</SiteConsumer>
						</div>
					) : null}
				</div>
			</div>
		);
	}
}

VideoViewer.defaultProps = {
	inEmbed: !0,
	siteUrl: PropTypes.string.isRequired,
};

VideoViewer.propTypes = {
	inEmbed: PropTypes.bool,
};

function findGetParameter(parameterName) {
	let result = null;
	let tmp = [];
	var items = location.search.substr(1).split('&');
	for (let i = 0; i < items.length; i++) {
		tmp = items[i].split('=');
		if (tmp[0] === parameterName) {
			result = decodeURIComponent(tmp[1]);
		}
	}
	return result;
}

function handleCanvas(videoElem) { // Make sure it's a video element

	if (!videoElem || !videoElem.tagName || videoElem.tagName.toLowerCase() !== 'video') {
		console.error('Invalid video element:', videoElem);
		return;
	}

	const Player = videojs(videoElem);
	Player.playsinline(true);

	Player.on('loadedmetadata', function () {
		const muted = parseInt(findGetParameter('muted'));
		const autoplay = parseInt(findGetParameter('autoplay'));
		const timestamp = parseInt(findGetParameter('t'));

		if (muted == 1) {
			Player.muted(true);
		}

		if (timestamp >= 0 && timestamp < Player.duration()) {
			// Start the video from the given time
			Player.currentTime(timestamp);
		} else if (timestamp >= 0 && timestamp >= Player.duration()) {
			// Restart the video if the given time is greater than the duration
			Player.play();
		}
		if (autoplay === 1) {
			Player.play();
		}
	});
}

const observer = new MutationObserver((mutations, me) => {
	const playerContainer = document.querySelector('.video-js.vjs-mediacms');
	if (playerContainer) {
		const video = playerContainer.querySelector('video');
		if (video) {
			video.classList.add('show-video'); // ✅ CSP-safe
			handleCanvas(video);
			me.disconnect();
		}
	}
});


observer.observe(document, {
	childList: true,
	subtree: true,
});
