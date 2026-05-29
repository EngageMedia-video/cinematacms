import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import PageStore from '../../../static/js/pages/_PageStore';
import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { Button } from '../../shared/components/Button/Button.jsx';
import { HorizontalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../../home/utils/mediaList';
import { buildMetadata, getAuthorLink, getAuthorName } from '../utils/mediaCardMetadata';

function readRelatedMedia() {
	const md = MediaPageStore.get('media-data');
	return md?.related_media?.length ? md.related_media : null;
}

export function RelatedMedia({ hideFirst = true }) {
	const [items, setItems] = useState(readRelatedMedia());
	const [mediaType, setMediaType] = useState(MediaPageStore.get('media-type'));
	const initialSize = PageStore.get('config-options').pages.media.related.initialSize;
	const [visibleCount, setVisibleCount] = useState(initialSize);

	useEffect(() => {
		function onMediaDataLoad() {
			setMediaType(MediaPageStore.get('media-type'));
			setItems(readRelatedMedia());
			setVisibleCount(initialSize);
		}

		MediaPageStore.on('loaded_media_data', onMediaDataLoad);
		return () => MediaPageStore.removeListener('loaded_media_data', onMediaDataLoad);
	}, [initialSize]);

	if (!items?.length) return null;

	const hideViews = !PageStore.get('config-media-item').displayViews;
	const relatedItems = hideFirst && (mediaType === 'video' || mediaType === 'audio') ? items.slice(1) : items;
	const displayItems = relatedItems.slice(0, visibleCount);
	const hasMoreItems = visibleCount < relatedItems.length;

	function onShowMoreClick() {
		setVisibleCount((currentVisibleCount) => Math.min(currentVisibleCount + initialSize, relatedItems.length));
	}

	if (!displayItems.length) return null;

	return (
		<div className="flex flex-col gap-size-20 mt-6 items-start">
			{displayItems.map((item) => (
				<HorizontalMovieItem
					key={item.friendly_token || item.url}
					title={item.title}
					imageSrc={item.thumbnail_url}
					link={item.url}
					duration={getMediaDurationLabel(item)}
					subtitle={getAuthorName(item)}
					subtitleLink={getAuthorLink(item)}
					metadata={buildMetadata(item, hideViews)}
				/>
			))}

			{hasMoreItems ? (
				<Button type="button" variant="text" size="sm" onClick={onShowMoreClick}>
					<span className="text-text-accent hover:text-text-link-hover">SHOW MORE</span>
				</Button>
			) : null}
		</div>
	);
}

RelatedMedia.propTypes = {
	hideFirst: PropTypes.bool,
};
