import React from 'react';
import PropTypes from 'prop-types';

import UserContext from '../../../static/js/contexts/UserContext';
import PlaylistsContext from '../../../static/js/contexts/PlaylistsContext';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { MediaLikeIcon } from './MediaLikeIcon';
import { OtherMediaDownloadLink } from './OtherMediaDownloadLink';
import { VideoMediaDownloadLink } from './VideoMediaDownloadLink';
import { MediaSaveButton } from './MediaSaveButton';
import { MediaShareButton } from './MediaShareButton';

import { formatNumber } from '../../../static/js/functions';
import { Text } from '../../shared/components/Text/Text.jsx';

function legacyContextValue(context) {
	return context['_currentValue'];
}

function MediaViewsChip({ displayViews, views }) {
	if (!displayViews) {
		return null;
	}

	return (
		<div className="read-only px-4" aria-label={`${views} views`}>
			<Text
				as="span"
				variant="body-14-medium"
				className="text-cinemata-neutral-900 dark:text-cinemata-strait-blue-100"
			>
				{formatNumber(views, true)} {1 >= views ? 'view' : 'views'}
			</Text>
		</div>
	);
}

export default function MediaActions({ allowDownload, displayViews, downloadLink, isVideo, title, views }) {
	const user = legacyContextValue(UserContext);
	const playlists = legacyContextValue(PlaylistsContext);

	return (
		<div className="flex flex-row justify-end items-center gap-2">
			<MediaViewsChip displayViews={displayViews} views={views} />

			{user.can.likeMedia ? <MediaLikeIcon /> : null}

			{user.can.shareMedia ? <MediaShareButton isVideo={isVideo} /> : null}

			{!user.is.anonymous &&
			user.can.saveMedia &&
			-1 < playlists.mediaTypes.indexOf(MediaPageStore.get('media-type')) ? (
				<MediaSaveButton />
			) : null}

			{!allowDownload || !user.can.downloadMedia ? null : !downloadLink ? (
				<VideoMediaDownloadLink />
			) : (
				<OtherMediaDownloadLink link={downloadLink} title={title} />
			)}
		</div>
	);
}

MediaViewsChip.propTypes = {
	displayViews: PropTypes.bool.isRequired,
	views: PropTypes.number,
};

MediaViewsChip.defaultProps = {
	views: 0,
};

MediaActions.propTypes = {
	allowDownload: PropTypes.bool.isRequired,
	displayViews: PropTypes.bool.isRequired,
	downloadLink: PropTypes.string,
	isVideo: PropTypes.bool.isRequired,
	title: PropTypes.string,
	views: PropTypes.number,
};

MediaActions.defaultProps = {
	downloadLink: null,
	title: '',
	views: 0,
};
