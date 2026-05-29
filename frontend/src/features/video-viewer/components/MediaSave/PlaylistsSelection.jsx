import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import * as PageActions from '../../../../static/js/pages/_PageActions.js';
import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../static/js/pages/MediaPage/actions.js';

import { Button } from '../../../shared/components/Button/Button';
import { CheckboxButton } from '../../../shared/components/CheckboxButton/CheckboxButton';
import { Icon } from '../../../shared/components/Icon/Icon';
import { Text } from '../../../shared/components/Text/Text';
import { TabContent, TabView } from '../../../shared/components/TabView/TabView';
import { PlaylistCreationForm } from './PlaylistCreationForm';

function PlaylistRow({ playlist, mediaId, mediaIds }) {
	const isChecked = playlist.media_list.some((item) => mediaIds.includes(item));

	function onChange() {
		if (isChecked) {
			MediaPageActions.removeMediaFromPlaylist(playlist.playlist_id, mediaId);
		} else {
			MediaPageActions.addMediaToPlaylist(playlist.playlist_id, mediaId);
		}
	}

	return (
		<CheckboxButton checked={isChecked} onChange={onChange} className="w-full py-size-8">
			<span className="truncate">{playlist.title}</span>
		</CheckboxButton>
	);
}

PlaylistRow.propTypes = {
	playlist: PropTypes.object.isRequired,
	mediaId: PropTypes.string,
	mediaIds: PropTypes.arrayOf(PropTypes.string).isRequired,
};

function snapshotPlaylists() {
	const playlists = MediaPageStore.get('playlists') || [];
	return playlists.map((playlist) => ({
		...playlist,
		media_list: Array.isArray(playlist.media_list) ? [...playlist.media_list] : [],
	}));
}

function SaveToTab() {
	const [playlists, setPlaylists] = useState(snapshotPlaylists);
	const mediaId = MediaPageStore.get('media-id');
	const mediaData = MediaPageStore.get('media-data');
	const mediaIds = [mediaId, mediaData?.friendly_token].filter(Boolean);

	useEffect(() => {
		function syncPlaylists() {
			setPlaylists(snapshotPlaylists());
		}

		function onAddSuccess() {
			syncPlaylists();
			PageActions.addNotification('Media added to playlist', 'playlistMediaAdditionComplete');
		}

		function onAddFail() {
			PageActions.addNotification("Media's addition to playlist failed", 'playlistMediaAdditionFail');
		}

		function onRemoveSuccess() {
			syncPlaylists();
			PageActions.addNotification('Media removed from playlist', 'playlistMediaRemovalComplete');
		}

		function onRemoveFail() {
			PageActions.addNotification("Media's removal from playlist failed", 'playlistMediaRemovalFail');
		}

		MediaPageStore.on('playlists_load', syncPlaylists);
		MediaPageStore.on('media_playlist_addition_completed', onAddSuccess);
		MediaPageStore.on('media_playlist_addition_failed', onAddFail);
		MediaPageStore.on('media_playlist_removal_completed', onRemoveSuccess);
		MediaPageStore.on('media_playlist_removal_failed', onRemoveFail);

		return () => {
			MediaPageStore.removeListener('playlists_load', syncPlaylists);
			MediaPageStore.removeListener('media_playlist_addition_completed', onAddSuccess);
			MediaPageStore.removeListener('media_playlist_addition_failed', onAddFail);
			MediaPageStore.removeListener('media_playlist_removal_completed', onRemoveSuccess);
			MediaPageStore.removeListener('media_playlist_removal_failed', onRemoveFail);
		};
	}, []);

	if (!playlists.length) {
		return (
			<div className="flex flex-col items-center gap-size-8 py-size-24 text-center">
				<Icon name="bookmark" size={32} decorative />
				<Text as="p" variant="body-14-regular" className="text-text-muted">
					There are no playlists yet.
				</Text>
			</div>
		);
	}

	return (
		<div className="flex max-h-[320px] flex-col gap-size-4 overflow-y-auto pr-size-4">
			{playlists.map((playlist) => (
				<PlaylistRow key={playlist.playlist_id} playlist={playlist} mediaId={mediaId} mediaIds={mediaIds} />
			))}
		</div>
	);
}

function CreateTab({ onCancel, onPlaylistCreated }) {
	return <PlaylistCreationForm onCancel={onCancel} onPlaylistSave={onPlaylistCreated} />;
}

CreateTab.propTypes = {
	onCancel: PropTypes.func.isRequired,
	onPlaylistCreated: PropTypes.func.isRequired,
};

export function PlaylistsSelection({ triggerPopupClose }) {
	const [activeTab, setActiveTab] = useState('saveTo');

	function onClose() {
		triggerPopupClose?.();
	}

	function onPlaylistCreated(newPlaylistData) {
		const mediaId = MediaPageStore.get('media-id');
		MediaPageActions.addNewPlaylist(newPlaylistData);
		MediaPageActions.addMediaToPlaylist(newPlaylistData.playlist_id, mediaId);
		onClose();
	}

	return (
		<div className="flex w-full max-w-[440px] flex-col gap-size-16 p-size-20">
			<div className="flex items-center justify-between">
				<Text as="h2" variant="body-16-bold" className="text-text-strong">
					Save to playlist
				</Text>
				<Button
					type="button"
					variant="icon"
					size="sm"
					aria-label="Close"
					onClick={onClose}
					icon={<Icon name="close" decorative />}
				/>
			</div>

			<TabView
				selectedTab={activeTab}
				onSelectedTabChange={setActiveTab}
				tabMode="fill"
				aria-label="Save options"
			>
				<TabContent title="Save to" value="saveTo">
					<div className="pt-size-16">
						<SaveToTab />
					</div>
				</TabContent>
				<TabContent title="Create new" value="createNew">
					<div className="pt-size-16">
						<CreateTab onCancel={onClose} onPlaylistCreated={onPlaylistCreated} />
					</div>
				</TabContent>
			</TabView>
		</div>
	);
}

PlaylistsSelection.propTypes = {
	triggerPopupClose: PropTypes.func,
};
