import React, { useContext, useEffect, useState } from 'react';

import ApiUrlContext from '../../../static/js/contexts/ApiUrlContext';
import TopMessage from '../../../static/js/components/-NEW-/TopMessage';
import HomepagePopup from '../../../static/js/components/-NEW-/HomepagePopup';

const TOP_MESSAGE_TEXT_KEY = 'MediaCMS["top-message-text"]';
const TOP_MESSAGE_DISPLAYED_KEY = 'MediaCMS["top-message-has-been-displayed"]';
const HOMEPAGE_POPUP_TEXT_KEY = 'MediaCMS["homepage-popup"]';
const HOMEPAGE_POPUP_DISPLAYED_KEY = 'MediaCMS["homepage-popup-has-been-displayed"]';

export function TopMessageHost() {
	const apiUrl = useContext(ApiUrlContext);

	const [topMessageText, setTopMessageText] = useState(() =>
		window.localStorage.getItem(TOP_MESSAGE_TEXT_KEY)
	);
	const [topMessageHasBeenDisplayed, setTopMessageHasBeenDisplayed] = useState(
		() => window.localStorage.getItem(TOP_MESSAGE_DISPLAYED_KEY) || 'true'
	);

	const [homepagePopupText, setHomepagePopupText] = useState(() => {
		if (window.location.pathname !== '/') {
			return true;
		}
		return window.localStorage.getItem(HOMEPAGE_POPUP_TEXT_KEY);
	});
	const [homepagePopupHasBeenDisplayed, setHomepagePopupHasBeenDisplayed] = useState(
		() => window.localStorage.getItem(HOMEPAGE_POPUP_DISPLAYED_KEY) || 'false'
	);

	useEffect(() => {
		if (!apiUrl) return;

		fetch(apiUrl.topmessage)
			.then((response) => response.json())
			.then((data) => {
				if (data.active === true) {
					if (window.localStorage.getItem(TOP_MESSAGE_TEXT_KEY) !== data.text) {
						setTopMessageText(data.text);
						setTopMessageHasBeenDisplayed('false');
						window.localStorage.setItem(TOP_MESSAGE_TEXT_KEY, data.text);
						window.localStorage.setItem(TOP_MESSAGE_DISPLAYED_KEY, 'false');
					}
				}
			})
			.catch(() => {});

		if (window.location.pathname === '/') {
			fetch(apiUrl.homepagepopup)
				.then((response) => response.json())
				.then((data) => {
					if (window.localStorage.getItem(HOMEPAGE_POPUP_TEXT_KEY) !== JSON.stringify(data)) {
						setHomepagePopupText(data);
						setHomepagePopupHasBeenDisplayed('false');
						window.localStorage.setItem(HOMEPAGE_POPUP_TEXT_KEY, JSON.stringify(data));
						window.localStorage.setItem(HOMEPAGE_POPUP_DISPLAYED_KEY, 'false');
					}
				})
				.catch(() => {});
		}
	}, [apiUrl]);

	useEffect(() => {
		const updateHeight = () => {
			const el = document.querySelector('.top-message');
			if (el) {
				document.body.style.setProperty('--top-message-height', el.offsetHeight + 'px');
			}
		};

		if (topMessageHasBeenDisplayed === 'false') {
			document.body.classList.add('top-message-body');
			requestAnimationFrame(updateHeight);
			window.addEventListener('resize', updateHeight);
		} else {
			document.body.classList.remove('top-message-body');
			document.body.style.setProperty('--top-message-height', '0px');
		}

		return () => window.removeEventListener('resize', updateHeight);
	}, [topMessageHasBeenDisplayed, topMessageText]);

	function closeAlert() {
		if (topMessageText) {
			setTopMessageHasBeenDisplayed('true');
			window.localStorage.setItem(TOP_MESSAGE_TEXT_KEY, topMessageText);
			window.localStorage.setItem(TOP_MESSAGE_DISPLAYED_KEY, 'true');
		}
	}

	function closeHomepagePopup() {
		if (homepagePopupText) {
			setHomepagePopupHasBeenDisplayed('true');
			window.localStorage.setItem(HOMEPAGE_POPUP_TEXT_KEY, JSON.stringify(homepagePopupText));
			window.localStorage.setItem(HOMEPAGE_POPUP_DISPLAYED_KEY, 'true');
		}
	}

	return (
		<>
			{topMessageHasBeenDisplayed !== 'true' && topMessageText !== null ? (
				<TopMessage message={topMessageText} onClick={closeAlert} />
			) : null}
			{homepagePopupHasBeenDisplayed !== 'true' && homepagePopupText !== null ? (
				<HomepagePopup message={homepagePopupText} onClick={closeHomepagePopup} />
			) : null}
		</>
	);
}
