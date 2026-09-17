import { useEffect, useState } from 'react';

import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';

import { PlaylistsSelection } from './media-save/PlaylistsSelection';
import { Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, Text } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames.js';
import { usePausePlayerWhileOpen } from './usePausePlayerWhileOpen';

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

const PRIVATE_MEDIA_NOTICE =
	"Private films can't be added to a playlist. Change this film's visibility to Public first.";

function isMediaPrivate() {
	return MediaPageStore.get('media-data')?.state === 'private';
}

export function MediaSaveButton() {
	const [isOpen, setIsOpen] = useState(false);
	const [savedToPlaylist, setSavedToPlaylist] = useState(isMediaInUserPlaylist);
	const [mediaIsPrivate, setMediaIsPrivate] = useState(isMediaPrivate);

	usePausePlayerWhileOpen(isOpen);

	const saveIconClassName = savedToPlaylist ? 'text-text-accent' : 'text-current';

	useEffect(() => {
		function syncSavedState() {
			setSavedToPlaylist(isMediaInUserPlaylist());
		}

		function syncPrivateState() {
			setMediaIsPrivate(isMediaPrivate());
		}

		MediaPageStore.on('playlists_load', syncSavedState);
		MediaPageStore.on('media_playlist_addition_completed', syncSavedState);
		MediaPageStore.on('media_playlist_removal_completed', syncSavedState);
		MediaPageStore.on('loaded_media_data', syncPrivateState);

		return () => {
			MediaPageStore.removeListener('playlists_load', syncSavedState);
			MediaPageStore.removeListener('media_playlist_addition_completed', syncSavedState);
			MediaPageStore.removeListener('media_playlist_removal_completed', syncSavedState);
			MediaPageStore.removeListener('loaded_media_data', syncPrivateState);
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
				className="w-full max-w-110 rounded-ds-12 bg-bg-surface shadow-2xl"
			>
				{mediaIsPrivate ? (
					<div className="flex w-full flex-col gap-8 px-8 py-8">
						<div className="flex items-center justify-between">
							<Text as="h2" variant="h4-medium" className="text-text-strong m-0">
								This film is private
							</Text>
							<DialogClose>
								<Button
									type="button"
									variant="icon"
									size="sm"
									aria-label="Close"
									icon={<Icon name="close" decorative />}
								/>
							</DialogClose>
						</div>
						<Text as="p" variant="body-14" className="text-text-muted m-0 p-0">
							{PRIVATE_MEDIA_NOTICE}
						</Text>
					</div>
				) : (
					<PlaylistsSelection triggerPopupClose={triggerPopupClose} />
				)}
			</DialogContent>
		</Dialog>
	);
}
