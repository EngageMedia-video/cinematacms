import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import PageStore from '../../../../static/js/pages/_PageStore';
import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';

import { HorizontalMovieItem } from '../../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../../../home/utils/mediaList';
import { buildMetadata, getAuthorLink, getAuthorName, getCategoryBadge } from '../../utils/mediaCardMetadata';

function readRelatedMedia() {
	const md = MediaPageStore.get('media-data');
	return md?.related_media?.length ? md.related_media : null;
}

export function RelatedMedia({ hideFirst = true }) {
	const [items, setItems] = useState(readRelatedMedia());
	const [mediaType, setMediaType] = useState(MediaPageStore.get('media-type'));
	const initialSize = PageStore.get('config-options').pages.media.related.initialSize;
	const [visibleCount, setVisibleCount] = useState(initialSize);
	const loadMoreRef = useRef(null);

	useEffect(() => {
		function onMediaDataLoad() {
			setMediaType(MediaPageStore.get('media-type'));
			setItems(readRelatedMedia());
			setVisibleCount(initialSize);
		}

		MediaPageStore.on('loaded_media_data', onMediaDataLoad);
		return () => MediaPageStore.removeListener('loaded_media_data', onMediaDataLoad);
	}, [initialSize]);

	const hideViews = !PageStore.get('config-media-item').displayViews;
	const mediaItems = items?.length ? items : [];
	const relatedItems =
		hideFirst && (mediaType === 'video' || mediaType === 'audio') ? mediaItems.slice(1) : mediaItems;
	const displayItems = relatedItems.slice(0, visibleCount);
	const hasMoreItems = visibleCount < relatedItems.length;

	const loadNextPage = useCallback(() => {
		setVisibleCount((currentVisibleCount) => Math.min(currentVisibleCount + initialSize, relatedItems.length));
	}, [initialSize, relatedItems.length]);

	useEffect(() => {
		const loadMoreElement = loadMoreRef.current;

		if (!hasMoreItems || !loadMoreElement) return undefined;

		if (typeof IntersectionObserver === 'undefined') {
			function onScroll() {
				if (loadMoreElement.getBoundingClientRect().top <= window.innerHeight) {
					loadNextPage();
				}
			}

			window.addEventListener('scroll', onScroll, { passive: true });
			window.addEventListener('resize', onScroll);
			onScroll();

			return () => {
				window.removeEventListener('scroll', onScroll);
				window.removeEventListener('resize', onScroll);
			};
		}

		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				loadNextPage();
			}
		});

		observer.observe(loadMoreElement);

		return () => observer.disconnect();
	}, [hasMoreItems, loadNextPage, visibleCount]);

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
					{...getCategoryBadge(item)}
				/>
			))}

			{hasMoreItems ? <div ref={loadMoreRef} aria-hidden="true" className="h-px w-full" /> : null}
		</div>
	);
}

RelatedMedia.propTypes = {
	hideFirst: PropTypes.bool,
};
