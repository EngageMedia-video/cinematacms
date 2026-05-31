import React, { useContext, useEffect, useRef, useState } from 'react';
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

function MediaViewsChip({ displayViews, views }) {
	if (!displayViews) {
		return null;
	}

	const viewLabel = 1 >= views ? 'view' : 'views';

	return (
		<div className="read-only pr-2 sm:px-4 shrink-0 whitespace-nowrap" aria-label={`${views} ${viewLabel}`}>
			<Text as="span" variant="body-14-medium" className="whitespace-nowrap text-text-strong">
				{formatNumber(views, true)} {viewLabel}
			</Text>
		</div>
	);
}

export default function MediaActions({ allowDownload, displayViews, downloadLink, isVideo, title, views }) {
	const actionsRef = useRef(null);
	const downloadPopupRef = useRef(null);
	const downloadTriggerRef = useRef(null);
	const [favorite, setFavorite] = useState(MediaPageStore.get('user-liked-media'));
	const userContext = useContext(UserContext);
	const user = { ...userContext, favorite };
	const playlists = useContext(PlaylistsContext);

	function updateFavoriteState() {
		setFavorite(MediaPageStore.get('user-liked-media'));
	}

	useEffect(() => {
		MediaPageStore.on('loaded_media_data', updateFavoriteState);
		MediaPageStore.on('liked_media', updateFavoriteState);
		MediaPageStore.on('unliked_media', updateFavoriteState);

		return () => {
			MediaPageStore.removeListener('loaded_media_data', updateFavoriteState);
			MediaPageStore.removeListener('liked_media', updateFavoriteState);
			MediaPageStore.removeListener('unliked_media', updateFavoriteState);
		};
	}, []);

	const canDownload = allowDownload && user.can.downloadMedia;

	useEffect(() => {
		if (!actionsRef.current) {
			return;
		}

		const frameId = requestAnimationFrame(() => {
			if (!actionsRef.current) {
				return;
			}

			actionsRef.current.scrollLeft = 0;
		});

		return () => {
			cancelAnimationFrame(frameId);
		};
	}, []);

	function hideVideoDownloadPopup() {
		downloadPopupRef.current?.tryToHide();
	}

	return (
		<div className="relative flex w-full min-w-0 items-center">
			<div
				ref={actionsRef}
				className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				onScroll={hideVideoDownloadPopup}
			>
				<div className="flex w-max min-w-full flex-nowrap items-center justify-end gap-1 sm:gap-2 *:shrink-0">
					<MediaViewsChip displayViews={displayViews} views={views} />

					{user.can.likeMedia && <MediaLikeIcon />}

					{!user.is.anonymous &&
						user.can.saveMedia &&
						-1 < playlists.mediaTypes.indexOf(MediaPageStore.get('media-type')) && <MediaSaveButton />}

					{user.can.shareMedia && <MediaShareButton isVideo={isVideo} />}

					{canDownload &&
						(!downloadLink ? (
							<VideoMediaDownloadLink contentRef={downloadPopupRef} triggerRef={downloadTriggerRef} />
						) : (
							<OtherMediaDownloadLink link={downloadLink} title={title} />
						))}
				</div>
			</div>
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
