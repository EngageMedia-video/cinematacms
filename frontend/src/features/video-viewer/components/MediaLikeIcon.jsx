import React, { useState, useEffect, useContext } from 'react';

import TextsContext from '../../../static/js/contexts/TextsContext';
import LinksContext from '../../../static/js/contexts/LinksContext';
import UserContext from '../../../static/js/contexts/UserContext';
import SiteContext from '../../../static/js/contexts/SiteContext';

import * as PageActions from '../../../static/js/pages/_PageActions.js';
import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../static/js/pages/MediaPage/actions.js';

import { formatNumber } from '../../../static/js/functions';
import { Button } from '../../shared/components/Button/Button.jsx';
import { Icon } from '../../shared/components/Icon/Icon.jsx';
import { Text } from '../../shared/components/Text/Text.jsx';

export function MediaLikeIcon() {
	const texts = useContext(TextsContext);
	const links = useContext(LinksContext);
	const user = useContext(UserContext);
	const site = useContext(SiteContext);

	const [likedMedia, setLikedMedia] = useState(MediaPageStore.get('user-liked-media'));
	const [likesCounter, setLikesCounter] = useState(formatNumber(MediaPageStore.get('media-likes'), false));
	const activeButtonClassName =
		'bg-cinemata-red-800 hover:bg-cinemata-red-400 dark:bg-cinemata-red-950 dark:hover:bg-cinemata-red-900';
	const iconClassName = likedMedia
		? 'text-cinemata-red-600 dark:text-cinemata-red-500'
		: 'text-cinemata-strait-blue-100';
	const textClassName = likedMedia
		? 'text-cinemata-red-700 dark:text-cinemata-red-100 whitespace-nowrap'
		: 'text-neutral-50 dark:text-cinemata-strait-blue-100 whitespace-nowrap';

	function updateStateValues() {
		setLikedMedia(MediaPageStore.get('user-liked-media'));
		setLikesCounter(formatNumber(MediaPageStore.get('media-likes'), false));
	}

	function onCompleteMediaLike() {
		updateStateValues();
		PageActions.addNotification(texts.addToLiked, 'likedMedia');
	}

	function onCompleteMediaLikeCancel() {
		updateStateValues();
		PageActions.addNotification(texts.removeFromLiked, 'unlikedMedia');
	}

	function onFailMediaLikeRequest() {
		PageActions.addNotification('Action failed', 'likedMediaRequestFail');
	}

	function toggleLike(ev) {
		ev.preventDefault();
		ev.stopPropagation();

		if (user.is.anonymous) {
			const currentPath = window.location.href.replace(site.url, '').replace(/^\//g, '');
			const loginUrl = links.signin + '?next=/' + currentPath;
			window.location.href = loginUrl;
			return;
		}

		MediaPageActions[likedMedia ? 'unlikeMedia' : 'likeMedia']();
	}

	useEffect(() => {
		MediaPageStore.on('liked_media', onCompleteMediaLike);
		MediaPageStore.on('unliked_media', onCompleteMediaLikeCancel);
		MediaPageStore.on('liked_media_failed_request', onFailMediaLikeRequest);
		return () => {
			MediaPageStore.removeListener('liked_media', onCompleteMediaLike);
			MediaPageStore.removeListener('unliked_media', onCompleteMediaLikeCancel);
			MediaPageStore.removeListener('liked_media_failed_request', onFailMediaLikeRequest);
		};
	}, []);

	return (
		<div className="like">
			<Button
				aria-label={likedMedia ? `Unlike media, ${likesCounter} likes` : `Like media, ${likesCounter} likes`}
				variant="secondary"
				icon={<Icon name={'thumbsUpFill'} className={iconClassName} />}
				className={likedMedia ? activeButtonClassName : undefined}
				onClick={toggleLike}
				size="sm"
			>
				<Text as="span" variant="body-14-medium" className={textClassName}>
					{likesCounter}
				</Text>
			</Button>
		</div>
	);
}
