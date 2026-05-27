import React, { useEffect, useState } from 'react';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import PageStore from '../../../static/js/pages/_PageStore.js';
import * as PageActions from '../../../static/js/pages/_PageActions.js';

import { HorizontalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { Switch } from '../../shared/components/Switch/Switch';
import { Text } from '../../shared/components/Text/Text';
import { getMediaDurationLabel } from '../../home/utils/mediaList';

function readAutoPlayMedia() {
	const md = MediaPageStore.get('media-data');
	return md?.related_media?.length ? md.related_media[0] : null;
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

export function AutoPlay() {
	const [media, setMedia] = useState(readAutoPlayMedia());
	const [enabledAutoPlay, setEnabledAutoPlay] = useState(PageStore.get('media-auto-play'));

	useEffect(() => {
		function onMediaDataLoad() {
			setMedia(readAutoPlayMedia());
		}

		function onUpdateMediaAutoPlay() {
			setEnabledAutoPlay(PageStore.get('media-auto-play'));
		}

		MediaPageStore.on('loaded_media_data', onMediaDataLoad);
		PageStore.on('switched_media_auto_play', onUpdateMediaAutoPlay);

		return () => {
			MediaPageStore.removeListener('loaded_media_data', onMediaDataLoad);
			PageStore.removeListener('switched_media_auto_play', onUpdateMediaAutoPlay);
		};
	}, []);

	if (!media) return null;

	const hideViews = !PageStore.get('config-media-item').displayViews;

	return (
		<div className="flex flex-col gap-size-12 pb-8 border-b border-cinemata-pacific-deep-600p">
			<div className="flex items-center justify-between">
				<Text as="h3" variant="body-16" className=" uppercase">
					Up next
				</Text>

				<label className="inline-flex cursor-pointer items-center gap-size-8">
					<Text as="span" variant="body-12-medium" className="uppercase text-text-strong">
						Autoplay
					</Text>

					<Switch checked={enabledAutoPlay} onChange={PageActions.toggleMediaAutoPlay} />
				</label>
			</div>

			<HorizontalMovieItem
				title={media.title}
				imageSrc={media.thumbnail_url}
				link={media.url}
				duration={getMediaDurationLabel(media)}
				subtitle={getAuthorName(media)}
				subtitleLink={getAuthorLink(media)}
				metadata={buildMetadata(media, hideViews)}
			/>
		</div>
	);
}
