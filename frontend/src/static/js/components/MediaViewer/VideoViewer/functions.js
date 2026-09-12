import SiteContext from '../../../contexts/SiteContext';

import { formatInnerLink } from '../../../functions/formatInnerLink';

// @note: Keep array items order.
const validVideoFormats = ['hls', 'h265', 'vp9', 'h264', 'vp8', 'mp4', 'theora'];

// Fallback start resolution for media without an HLS master playlist.
export const DEFAULT_NUMERIC_RESOLUTION = 720;

function browserSupports_videoCodec(what, debugLog) {
	/*
	 * @link: https://stackoverflow.com/questions/40039076/how-can-i-precisely-detect-hls-support-on-different-browsers-and-different-os#answer-40039470
	 * @link: http://www.leanbackplayer.com/test/h5mt.html
	 * @link: https://github.com/Modernizr/Modernizr/blob/master/feature-detects/video.js
	 */

	let ret = null,
		vid = document.createElement('video');

	if (!!vid.canPlayType) {
		try {
			switch (what) {
				case 'hls':
					// ret = 'probably' === vid.canPlayType('application/x-mpegURL; codecs="avc1.42E01E"');
					// @note: Return always 'true' and allow player to decide...
					ret = true;
					break;
				case 'h265':
					ret =
						'probably' === vid.canPlayType('video/mp4; codecs="hvc1.1.L0.0"') ||
						'probably' === vid.canPlayType('video/mp4; codecs="hev1.1.L0.0"');
					break;
				case 'h264':
					ret =
						'probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E"') ||
						'probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
					break;
				case 'vp9':
					ret = 'probably' === vid.canPlayType('video/webm; codecs="vp9"');
					break;
				case 'vp8':
					ret = 'probably' === vid.canPlayType('video/webm; codecs="vp8, vorbis"');
					break;
				case 'theora':
					ret = 'probably' === vid.canPlayType('video/ogg; codecs="theora"');
					break;
				case 'mp4':
					// ret = 'probably' === vid.canPlayType('video/mp4; codecs="mp4v.20.8"');
					ret = true; // @note: Return always 'true', as the default video format.
					break;
			}

			// Log BUGGY states.

			debugLog = debugLog instanceof Boolean || 0 === debugLog || 1 == debugLog ? debugLog : false;

			if (debugLog) {
				if ('no' === vid.canPlayType('video/nonsense')) {
					console.warn(
						'BUGGY: Codec detection bug in Firefox 3.5.0 - 3.5.1 and Safari 4.0.0 - 4.0.4 that answer "no" to unknown codecs instead of an empty string'
					);
				}

				if ('probably' === vid.canPlayType('video/webm')) {
					console.warn(
						'BUGGY: Codec detection bug that Firefox 27 and earlier always says "probably" when asked about WebM, even when the codecs string is not present'
					);
				}

				if ('maybe' === vid.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
					switch (vid.canPlayType('video/mp4')) {
						case 'probably':
							console.warn(
								'BUGGY: Codec detection bug in iOS 4.1 and earlier that switches "maybe" and "probably" around'
							);
							break;
						case 'maybe':
							console.warn(
								'BUGGY: Codec detection bug in Android where no better answer than "maybe" is given'
							);
							break;
					}
				}

				if (
					'probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') &&
					'probably' !== vid.canPlayType('video/mp4; codecs="avc1.42E01E"')
				) {
					console.warn(
						'BUGGY: Codec detection bug in Internet Explorer 9 that requires both audio and video codec on test'
					);
				}
			}
		} catch (e) {
			console.warn(e);
		}
	}

	return ret;
}

/*
 * @link: https://github.com/Modernizr/Modernizr/blob/master/feature-detects/video.js
 */
export function orderedSupportedVideoFormats(includeAll) {
	let order = [];
	let supports = {};
	let vid = document.createElement('video');

	if (!!vid.canPlayType) {
		/*console.warn( vid.canPlayType('application/x-mpegURL; codecs="avc1.42E01E"') );
		console.warn( vid.canPlayType('application/x-mpegURL; codecs="avc1.42E01E, mp4a.40.2"') );*/

		/*if( '' === vid.canPlayType('application/x-mpegURL; codecs="avc1.42E01E"') ){ */
		// @note: Return always 'true' and allow player to decide...
		supports.hls = !0;
		order.push('hls');
		/*}*/

		if (
			vid.canPlayType('video/mp4; codecs="hvc1.1.L0.0"') ||
			'probably' === vid.canPlayType('video/mp4; codecs="hev1.1.L0.0"')
		) {
			supports.h265 = !0;
			order.push('h265');
		}

		if ('probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
			supports.h264 = !0;
			order.push('h264');
		}

		if ('probably' === vid.canPlayType('video/webm; codecs="vp9"')) {
			supports.vp9 = !0;
			order.push('vp9');
		}

		if (includeAll) {
			if ('probably' === vid.canPlayType('video/webm; codecs="vp8, vorbis"')) {
				supports.vp8 = !0;
				order.push('vp8');
			}

			if ('probably' === vid.canPlayType('video/ogg; codecs="theora"')) {
				supports.theora = !0;
				order.push('theora');
			}
		}

		if ('probably' === vid.canPlayType('video/mp4; codecs="mp4v.20.8"')) {
			supports.mp4 = !0;
			order.push('mp4');
		}
	}

	return {
		order: order,
		support: supports,
	};
}

export function videoAvailableCodecsAndResolutions(data, hlsData, supportedFormats) {
	const ret = {};
	let i, k, fileExt;

	supportedFormats = void 0 === supportedFormats ? orderedSupportedVideoFormats() : supportedFormats;

	const supportedFormatsExtensions = {
		hls: ['m3u8'],
		h265: ['mp4', 'webm'],
		h264: ['mp4', 'webm'],
		vp9: ['mp4', 'webm'],
		vp8: ['mp4', 'webm'],
		theora: ['ogg'],
		mp4: ['mp4'],
	};

	// console.log( hlsData );

	for (i in hlsData) {
		if (hlsData.hasOwnProperty(i)) {
			k = null;

			if ('master_file' === i) {
				k = 'Auto';
			} else {
				k = i.split('_playlist');
				k = 2 === k.length ? k[0] : null;
			}

			if (null !== k) {
				ret[k] = void 0 === ret[k] ? { format: [], url: [] /*, type: []*/ } : ret[k];

				ret[k].format.push('hls');
				/*ret[k].type.push( 'application/x-mpegURL' );*/

				ret[k].url.push(formatInnerLink(hlsData[i], SiteContext._currentValue.url));
			}
		}
	}

	for (k in data) {
		if (data.hasOwnProperty(k) && Object.keys(data[k]).length) {
			// @todo: With HLS doesn't matter the screen's height..?
			if (1080 >= parseInt(k, 10) || (1080 < window.screen.width && 1080 < window.screen.height)) {
				i = 0;
				while (i < validVideoFormats.length) {
					if (void 0 !== data[k][validVideoFormats[i]]) {
						if (
							browserSupports_videoCodec(validVideoFormats[i], !1) &&
							data[k][validVideoFormats[i]] &&
							data[k][validVideoFormats[i]].url
						) {
							if (100 !== data[k][validVideoFormats[i]].progress) {
								console.warn(
									'VIDEO DEBUG:',
									'PROGRESS value is',
									data[k][validVideoFormats[i]].progress
								);
								// console.warn( "VIDEO DEBUG:", "LOG:", data[k][validVideoFormats[i]].log );
							}

							if ('success' !== data[k][validVideoFormats[i]].status) {
								console.warn('VIDEO DEBUG:', 'STATUS value is', data[k][validVideoFormats[i]].status);
								// console.warn( "VIDEO DEBUG:", "LOG:", data[k][validVideoFormats[i]].log );
							}

							// Handle versioned URLs with query parameters
							const mediaUrl = data[k][validVideoFormats[i]].url;
							if (!mediaUrl) continue; // Add check

							const urlWithoutQuery = mediaUrl.split('?')[0];
							fileExt = urlWithoutQuery.split('.');

							if (
								fileExt.length &&
								0 <=
									supportedFormatsExtensions[validVideoFormats[i]].indexOf(
										fileExt[fileExt.length - 1]
									)
							) {
								ret[k] = void 0 === ret[k] ? { format: [], url: [] } : ret[k];
								ret[k].format.push(validVideoFormats[i]);
								ret[k].url.push(formatInnerLink(mediaUrl, SiteContext._currentValue.url));
							}
						}
					}

					i += 1;
				}
			}
		}
	}

	/*console.log( "ret" );
	console.log( ret );*/

	return ret;
}

/**
 * Choose the resolution the player starts on.
 *
 * A viewer with no stored preference gets 'Auto' (the HLS master playlist) so
 * Video.js/VHS can adapt the bitrate and exclude a bad rendition, instead of
 * being pinned to a single variant playlist with no fallback (#790). A stored
 * preference is always honoured. Media whose `hls_info` carries no
 * `master_file` keeps the previous numeric default.
 *
 * @param {string|number|null|undefined} storedQuality - Cached 'video-quality' preference.
 * @param {Object} videoInfo - Available resolutions, as built by videoAvailableCodecsAndResolutions.
 * @returns {string|number} The resolution to request.
 */
export function selectDefaultResolution(storedQuality, videoInfo) {
	const info = videoInfo || {};
	const hasAuto = void 0 !== info['Auto'];

	if (null === storedQuality || void 0 === storedQuality) {
		return hasAuto ? 'Auto' : DEFAULT_NUMERIC_RESOLUTION;
	}

	if ('Auto' === storedQuality && !hasAuto) {
		return DEFAULT_NUMERIC_RESOLUTION;
	}

	return storedQuality;
}

/**
 * Resolve a requested resolution to a key that actually exists in `data`.
 *
 * @note: `data` mixes numeric resolution keys ('240', '720', ...) with the
 * non-numeric 'Auto' key that maps to the HLS master playlist. Only numeric
 * keys take part in nearest-neighbour matching, so a non-numeric request that
 * is absent never snaps to a numeric neighbour.
 *
 * @param {string|number} def - Requested resolution key.
 * @param {Object} data - Available resolutions, keyed by resolution.
 * @returns {string|undefined} An existing key of `data`, or undefined when `data` is empty.
 */
export function extractDefaultVideoResolution(def, data) {
	const keys = Object.keys(data || {});

	if (!keys.length) {
		return void 0;
	}

	// Return the key as it appears in `data`. A numeric `def` matches a string
	// key through coercion, so returning `def` unchanged would hand back a
	// number where every other branch returns a string.
	if (void 0 !== data[def]) {
		return keys.find((key) => key === String(def));
	}

	const requested = parseInt(def, 10);

	// A non-numeric request ('Auto') that is absent has no numeric neighbour to
	// snap to. Fall back to the highest available numeric resolution instead.
	const numericKeys = keys.filter((key) => !isNaN(parseInt(key, 10)));

	if (!numericKeys.length) {
		return keys[0];
	}

	const ascending = numericKeys.slice().sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

	if (isNaN(requested)) {
		return ascending[ascending.length - 1];
	}

	// Nearest numeric key that is greater than or equal to the request, so
	// quality degrades upward rather than silently dropping below the request.
	const atLeastRequested = ascending.find((key) => parseInt(key, 10) >= requested);

	return void 0 !== atLeastRequested ? atLeastRequested : ascending[ascending.length - 1];
}
