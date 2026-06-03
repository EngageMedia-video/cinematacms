import React, { useEffect, useState } from 'react';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { PlaylistsSelection } from './MediaSave/PlaylistsSelection';
import { Button, Dialog, DialogContent, DialogTrigger, Icon, Text } from '../../shared/components';
import { cn } from '../../shared/utils/classNames.js';

function isMediaInUserPlaylist() {
	const mediaId = MediaPageStore.get('media-id');
	const mediaData = MediaPageStore.get('media-data');
	const mediaIds = [mediaId, mediaData?.friendly_token].filter(Boolean);
	const playlists = MediaPageStore.get('playlists');

	if (!mediaIds.length || !Array.isArray(playlists)) {
		return false;
	}

	return playlists.some(
		(playlist) => Array.isArray(playlist.media_list) && playlist.media_list.some((item) => mediaIds.includes(item))
	);
}

export function MediaSaveButton() {
	const [isOpen, setIsOpen] = useState(false);
	const [savedToPlaylist, setSavedToPlaylist] = useState(isMediaInUserPlaylist);

	const saveIconClassName = savedToPlaylist ? 'text-text-accent' : 'text-current';

	useEffect(() => {
		function syncSavedState() {
			setSavedToPlaylist(isMediaInUserPlaylist());
		}

		MediaPageStore.on('playlists_load', syncSavedState);
		MediaPageStore.on('media_playlist_addition_completed', syncSavedState);
		MediaPageStore.on('media_playlist_removal_completed', syncSavedState);

		return () => {
			MediaPageStore.removeListener('playlists_load', syncSavedState);
			MediaPageStore.removeListener('media_playlist_addition_completed', syncSavedState);
			MediaPageStore.removeListener('media_playlist_removal_completed', syncSavedState);
		};
	}, []);

	function triggerPopupClose() {
		setIsOpen(false);
	}

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<div className="sm:hidden">
				<DialogTrigger>
					<Button
						aria-label={savedToPlaylist ? 'Added to playlist' : 'Save to playlist'}
						variant="tertiary"
						icon={<Icon name="bookmarkFilled" className={saveIconClassName} />}
						className={cn(
							'body-body-14-medium whitespace-nowrap p-size-8',
							savedToPlaylist ? 'bg-bg-button-playlist-active' : undefined
						)}
						size="sm"
					/>
				</DialogTrigger>
			</div>
			<div className="hidden sm:block">
				<DialogTrigger>
					<Button
						aria-label={savedToPlaylist ? 'Added to playlist' : 'Save to playlist'}
						variant="tertiary"
						icon={<Icon name="bookmarkFilled" className={saveIconClassName} />}
						className={cn(
							'body-body-14-medium whitespace-nowrap',
							savedToPlaylist ? 'bg-bg-button-playlist-active' : undefined
						)}
						size="sm"
					>
						<Text as="span" variant="body-14-medium" className="whitespace-nowrap text-current">
							Save To Playlist
						</Text>
					</Button>
				</DialogTrigger>
			</div>

			<DialogContent
				aria-label="Save to playlist"
				className="w-full max-w-[440px] rounded-ds-12 bg-bg-surface shadow-2xl"
			>
				<PlaylistsSelection triggerPopupClose={triggerPopupClose} />
			</DialogContent>
		</Dialog>
	);
}
