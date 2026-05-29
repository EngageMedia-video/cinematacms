import React, { useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import LinksContext from '../../../static/js/contexts/LinksContext';
import SiteContext from '../../../static/js/contexts/SiteContext';

import * as PageActions from '../../../static/js/pages/_PageActions.js';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../static/js/pages/MediaPage/actions.js';

import { Button } from '../../shared/components/Button/Button.jsx';
import { Icon } from '../../shared/components/Icon/Icon.jsx';
import { Text } from '../../shared/components/Text/Text.jsx';

export function MediaAddToFavorites({ user, onFavoriteChange }) {
	const links = useContext(LinksContext);
	const site = useContext(SiteContext);
	const [pending, setPending] = useState(false);
	const pendingActionRef = useRef(null);

	function updateStateValues() {
		onFavoriteChange(MediaPageStore.get('user-liked-media'));
		setPending(false);
	}

	function onCompleteAddToFavorites() {
		updateStateValues();
		if ('add' === pendingActionRef.current) {
			PageActions.addNotification('Added to favorites', 'addedToFavorites');
		}
		pendingActionRef.current = null;
	}

	function onCompleteRemoveFromFavorites() {
		updateStateValues();
		if ('remove' === pendingActionRef.current) {
			PageActions.addNotification('Removed from favorites', 'removedFromFavorites');
		}
		pendingActionRef.current = null;
	}

	function onFailAddToFavoritesRequest() {
		if (pendingActionRef.current) {
			PageActions.addNotification('Action failed', 'addToFavoritesRequestFail');
		}
		pendingActionRef.current = null;
		setPending(false);
	}

	function addToFavorites(ev) {
		ev.preventDefault();
		ev.stopPropagation();

		if (user.is.anonymous) {
			const currentPath = window.location.href.replace(site.url, '').replace(/^\//g, '');
			const loginUrl = links.signin + '?next=' + encodeURIComponent('/' + currentPath);
			window.location.href = loginUrl;
			return;
		}

		if (user.favorite) {
			return;
		}

		pendingActionRef.current = 'add';
		setPending(true);
		MediaPageActions.likeMedia();
	}

	useEffect(() => {
		MediaPageStore.on('liked_media', onCompleteAddToFavorites);
		MediaPageStore.on('unliked_media', onCompleteRemoveFromFavorites);
		MediaPageStore.on('liked_media_failed_request', onFailAddToFavoritesRequest);

		return () => {
			MediaPageStore.removeListener('liked_media', onCompleteAddToFavorites);
			MediaPageStore.removeListener('unliked_media', onCompleteRemoveFromFavorites);
			MediaPageStore.removeListener('liked_media_failed_request', onFailAddToFavoritesRequest);
		};
	}, []);

	return (
		<Button
			variant="primary"
			icon={<Icon name="love" className="text-current" />}
			className="body-body-14-medium"
			onClick={addToFavorites}
			size="sm"
			aria-pressed={user.favorite}
			disabled={pending}
		>
			<Text as="span" variant="body-14-medium" className="text-current">
				Add To Favorites
			</Text>
		</Button>
	);
}

MediaAddToFavorites.propTypes = {
	user: PropTypes.shape({
		favorite: PropTypes.bool,
		is: PropTypes.shape({
			anonymous: PropTypes.bool,
		}).isRequired,
	}).isRequired,
	onFavoriteChange: PropTypes.func.isRequired,
};
