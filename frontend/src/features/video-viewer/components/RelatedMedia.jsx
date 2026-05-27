import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import PageStore from '../../../static/js/pages/_PageStore';
import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { HorizontalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../../home/utils/mediaList';

function readRelatedMedia() {
	const md = MediaPageStore.get('media-data');
	return md?.related_media?.length ? md.related_media : null;
}

function getAuthorName(item) {
	return item.author_name || item.user || '';
}

function getAuthorLink(item) {
	return item.author_profile || '';
}

function getCountryNames(item) {
	if (Array.isArray(item.media_country_info)) {
		const countries = item.media_country_info.map((country) => country?.title).filter(Boolean);
		return countries.length ? countries : [item.media_country].filter(Boolean);
	}

	if (item.media_country_info?.title) {
		return [item.media_country_info.title];
	}

	return [item.media_country].filter(Boolean);
}

function buildMetadata(item, hideViews) {
	const metadata = [...getCountryNames(item)];

	if (!hideViews && item.views != null) {
		metadata.push(`${Number(item.views).toLocaleString()} views`);
	}

	return metadata;
}

export function RelatedMedia({ hideFirst = true }) {
	const [items, setItems] = useState(readRelatedMedia());
	const [mediaType, setMediaType] = useState(MediaPageStore.get('media-type'));

	useEffect(() => {
		function onMediaDataLoad() {
			setMediaType(MediaPageStore.get('media-type'));
			setItems(readRelatedMedia());
		}

		MediaPageStore.on('loaded_media_data', onMediaDataLoad);
		return () => MediaPageStore.removeListener('loaded_media_data', onMediaDataLoad);
	}, []);

	if (!items?.length) return null;

	const initialSize = PageStore.get('config-options').pages.media.related.initialSize;
	const hideViews = !PageStore.get('config-media-item').displayViews;

	const displayItems = (hideFirst && (mediaType === 'video' || mediaType === 'audio') ? items.slice(1) : items).slice(
		0,
		initialSize
	);

	if (!displayItems.length) return null;

	return (
		<div className="flex flex-col gap-size-20 mt-6">
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
		</div>
	);
}

RelatedMedia.propTypes = {
	hideFirst: PropTypes.bool,
};
