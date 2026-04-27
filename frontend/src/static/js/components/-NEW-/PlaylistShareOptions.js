import React, { useRef, useState, useEffect, useContext, useMemo } from 'react';

import LayoutStore from '../../stores/LayoutStore.js';

import PageStore from '../../pages/_PageStore.js';
import * as PageActions from '../../pages/_PageActions.js';

import ItemsInlineSlider from './includes/itemLists/ItemsInlineSlider';

import { CircleIconButton } from './CircleIconButton';

import ShareOptionsContext from '../../contexts/ShareOptionsContext';

function shareOptionsList(socialMedia, encodedUrl, encodedTitle) {
	const ret = {};

	let i = 0;

	while (i < socialMedia.length) {
		switch (socialMedia[i]) {
			case 'email':
				ret[socialMedia[i]] = {
					title: 'Email',
					shareUrl: 'mailto:?body=' + encodedUrl,
				};
				break;
			case 'fb':
				ret[socialMedia[i]] = {
					title: 'Facebook',
					shareUrl: 'https://www.facebook.com/sharer.php?u=' + encodedUrl,
				};
				break;
			case 'tw':
				ret[socialMedia[i]] = {
					title: 'Twitter',
					shareUrl: 'https://twitter.com/intent/tweet?url=' + encodedUrl,
				};
				break;
			case 'reddit':
				ret[socialMedia[i]] = {
					title: 'reddit',
					shareUrl: 'https://reddit.com/submit?url=' + encodedUrl + '&title=' + encodedTitle,
				};
				break;
			case 'tumblr':
				ret[socialMedia[i]] = {
					title: 'Tumblr',
					shareUrl:
						'https://www.tumblr.com/widgets/share/tool?canonicalUrl=' +
						encodedUrl +
						'&title=' +
						encodedTitle,
				};
				break;
			case 'pinterest':
				ret[socialMedia[i]] = {
					title: 'Pinterest',
					shareUrl: 'http://pinterest.com/pin/create/link/?url=' + encodedUrl,
				};
				break;
			case 'vk':
				ret[socialMedia[i]] = {
					title: 'ВКонтакте',
					shareUrl: 'http://vk.com/share.php?url=' + encodedUrl + '&title=' + encodedTitle,
				};
				break;
			case 'linkedin':
				ret[socialMedia[i]] = {
					title: 'LinkedIn',
					shareUrl: 'https://www.linkedin.com/shareArticle?mini=true&url=' + encodedUrl,
				};
				break;
			case 'mix':
				ret[socialMedia[i]] = {
					title: 'Mix',
					shareUrl: 'https://mix.com/add?url=' + encodedUrl,
				};
				break;
			case 'whatsapp':
				ret[socialMedia[i]] = {
					title: 'WhatsApp',
					shareUrl: 'whatsapp://send?text=' + encodedUrl,
				};
				break;
			case 'telegram':
				ret[socialMedia[i]] = {
					title: 'Telegram',
					shareUrl: 'https://t.me/share/url?url=' + encodedUrl + '&text=' + encodedTitle,
				};
				break;
			// Skip 'embed' — playlists are not embeddable
		}

		i += 1;
	}

	return ret;
}

function ShareOptions(socialMedia, encodedUrl, encodedTitle) {
	const shareOptions = shareOptionsList(socialMedia, encodedUrl, encodedTitle);

	const compList = [];

	for (let k in shareOptions) {
		if (shareOptions.hasOwnProperty(k)) {
			if (k === 'whatsapp') {
				compList.push(
					<div key={'share-' + k} className={'sh-option share-' + k}>
						<a
							href={shareOptions[k].shareUrl}
							title=""
							target="_blank"
							rel="noopener noreferrer"
							data-action="share/whatsapp/share"
						>
							<span></span>
							<span>{shareOptions[k].title}</span>
						</a>
					</div>
				);
			} else if (k === 'email') {
				compList.push(
					<div key="share-email" className="sh-option share-email">
						<a href={shareOptions[k].shareUrl} title="">
							<span>
								<i className="material-icons">email</i>
							</span>
							<span>{shareOptions[k].title}</span>
						</a>
					</div>
				);
			} else {
				compList.push(
					<div key={'share-' + k} className={'sh-option share-' + k}>
						<a href={shareOptions[k].shareUrl} title="" target="_blank" rel="noopener noreferrer">
							<span></span>
							<span>{shareOptions[k].title}</span>
						</a>
					</div>
				);
			}
		}
	}

	return compList;
}

function NextSlideButton({ onClick }) {
	return (
		<span className="next-slide">
			<CircleIconButton buttonShadow={true} onClick={onClick}>
				<i className="material-icons">keyboard_arrow_right</i>
			</CircleIconButton>
		</span>
	);
}

function PreviousSlideButton({ onClick }) {
	return (
		<span className="previous-slide">
			<CircleIconButton buttonShadow={true} onClick={onClick}>
				<i className="material-icons">keyboard_arrow_left</i>
			</CircleIconButton>
		</span>
	);
}

function updateDimensions() {
	return {
		maxFormContentHeight: LayoutStore.get('container-height') - (56 + 4 * 24 + 44),
		maxPopupWidth:
			518 > LayoutStore.get('container-width') - 2 * 40 ? LayoutStore.get('container-width') - 2 * 40 : null,
	};
}

export function PlaylistShareOptions(props) {
	const containerRef = useRef(null);
	const shareOptionsInnerRef = useRef(null);

	const [inlineSlider, setInlineSlider] = useState(null);
	const [sliderButtonsVisible, setSliderButtonsVisible] = useState({ prev: false, next: false });

	const [dimensions, setDimensions] = useState(updateDimensions());

	// Read the share platform list from context instead of the private
	// `_currentValue` internal. The app doesn't currently mount a Provider
	// (the default-value path is the only path), but going through useContext
	// keeps us off private React APIs and lets a future Provider work as
	// expected without touching this component.
	const socialMedia = useContext(ShareOptionsContext);

	// Derive share options reactively from props + context so URL/title/
	// platform-list changes propagate to the UI. useMemo also avoids rebuilding
	// the option list on every unrelated re-render (slider state, resize).
	const shareOptions = useMemo(() => {
		const encodedUrl = encodeURIComponent(props.url || '');
		const encodedTitle = encodeURIComponent(props.title || '');
		return ShareOptions(socialMedia, encodedUrl, encodedTitle);
	}, [props.url, props.title, socialMedia]);

	function onWindowResize() {
		setDimensions(updateDimensions());
	}

	function onClickCopyLink() {
		const input = containerRef.current && containerRef.current.querySelector('.copy-field input');
		if (!input) {
			return;
		}

		function notifySuccess() {
			PageActions.addNotification('Link copied to clipboard', 'clipboardLinkCopy');
		}

		function notifyFailure(err) {
			const detail = err && err.message ? ': ' + err.message : '';
			PageActions.addNotification("Couldn't copy link, please copy manually" + detail, 'clipboardLinkCopy');
		}

		// Fallback path for insecure origins / older browsers where the async
		// Clipboard API isn't available. Selects the input so the user can
		// manually copy if execCommand also fails.
		function copyViaExecCommand() {
			try {
				input.focus();
				input.select();
				input.setSelectionRange(0, input.value.length);
				const ok = document.execCommand && document.execCommand('copy');
				if (ok) {
					notifySuccess();
				} else {
					notifyFailure(new Error('execCommand copy returned false'));
				}
			} catch (err) {
				notifyFailure(err);
			}
		}

		if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
			navigator.clipboard
				.writeText(input.value)
				.then(notifySuccess)
				.catch(function (err) {
					// Some browsers reject writeText even on secure origins (e.g.,
					// document not focused, permissions policy). Try the legacy
					// path before giving up and surfacing the error.
					copyViaExecCommand();
					if (err) {
						// eslint-disable-next-line no-console
						console.warn('clipboard.writeText failed, falling back to execCommand:', err);
					}
				});
		} else {
			copyViaExecCommand();
		}
	}

	function updateSlider() {
		inlineSlider.scrollToCurrentSlide();
		updateSliderButtonsView();
	}

	function updateSliderButtonsView() {
		setSliderButtonsVisible({
			prev: inlineSlider.hasPreviousSlide(),
			next: inlineSlider.hasNextSlide(),
		});
	}

	function nextSlide(e) {
		// Stop propagation so the click-outside listener in PopupContent doesn't
		// close the modal. React can re-render the arrow button between our
		// onClick and the document-level click handler, which would otherwise
		// detach ev.target and make popup.contains(target) return false.
		if (e) {
			e.stopPropagation();
		}
		inlineSlider.nextSlide();
		updateSlider();
	}

	function prevSlide(e) {
		if (e) {
			e.stopPropagation();
		}
		inlineSlider.previousSlide();
		updateSlider();
	}

	useEffect(() => {
		setInlineSlider(new ItemsInlineSlider(shareOptionsInnerRef.current, '.sh-option'));
	}, [shareOptions]);

	useEffect(() => {
		if (inlineSlider) {
			inlineSlider.updateDataStateOnResize(shareOptions.length, true, true);
			updateSlider();
		}
	}, [dimensions, inlineSlider]);

	useEffect(() => {
		PageStore.on('window_resize', onWindowResize);

		return () => {
			PageStore.removeListener('window_resize', onWindowResize);
			setInlineSlider(null);
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className="playlist-share-options"
			style={null !== dimensions.maxPopupWidth ? { maxWidth: dimensions.maxPopupWidth + 'px' } : null}
		>
			<div
				className="scrollable-content"
				style={
					null !== dimensions.maxFormContentHeight
						? { maxHeight: dimensions.maxFormContentHeight + 'px' }
						: null
				}
			>
				<div className="share-popup-title">Share playlist</div>
				{props.thumbnailUrl ? (
					<div className="share-preview">
						<img src={props.thumbnailUrl} alt={props.title || 'Playlist preview'} />
					</div>
				) : null}
				{shareOptions.length ? (
					<div className="share-options">
						{sliderButtonsVisible.prev ? <PreviousSlideButton onClick={prevSlide} /> : null}
						<div ref={shareOptionsInnerRef} className="share-options-inner">
							{shareOptions}
						</div>
						{sliderButtonsVisible.next ? <NextSlideButton onClick={nextSlide} /> : null}
					</div>
				) : null}
			</div>
			<div className="copy-field">
				<div>
					<input type="text" readOnly value={props.url} />
					<button onClick={onClickCopyLink}>COPY</button>
				</div>
			</div>
		</div>
	);
}
