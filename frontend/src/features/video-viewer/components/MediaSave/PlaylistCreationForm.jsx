import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import * as PageActions from '../../../../static/js/pages/_PageActions.js';
import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../static/js/pages/MediaPage/actions.js';

import { Button } from '../../../shared/components/Button/Button';
import { Text } from '../../../shared/components/Text/Text';
import { cn } from '../../../shared/utils/classNames';

function extractPlaylistId(url) {
	if (!url) return null;
	const parts = url.split('/').filter(Boolean);
	return parts.length ? parts[parts.length - 1] : null;
}

export function PlaylistCreationForm({ onCancel, onPlaylistSave }) {
	const nameInputRef = useRef(null);
	const descriptionInputRef = useRef(null);

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [titleInvalid, setTitleInvalid] = useState(false);

	useEffect(() => {
		nameInputRef.current?.focus();

		function onCreationCompleted(newPlaylistData) {
			PageActions.addNotification('Playlist created', 'playlistCreationCompleted');
			const plistData = {
				playlist_id: extractPlaylistId(newPlaylistData.url),
				add_date: newPlaylistData.add_date,
				description: newPlaylistData.description,
				title: newPlaylistData.title,
				media_list: [],
			};
			onPlaylistSave?.(plistData);
		}

		function onCreationFailed() {
			PageActions.addNotification('Playlist creation failed', 'playlistCreationFailed');
		}

		MediaPageStore.on('playlist_creation_completed', onCreationCompleted);
		MediaPageStore.on('playlist_creation_failed', onCreationFailed);

		return () => {
			MediaPageStore.removeListener('playlist_creation_completed', onCreationCompleted);
			MediaPageStore.removeListener('playlist_creation_failed', onCreationFailed);
		};
	}, [onPlaylistSave]);

	function onSubmit(event) {
		event.preventDefault();
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			setTitleInvalid(true);
			nameInputRef.current?.focus();
			return;
		}

		MediaPageActions.createPlaylist({
			title: trimmedTitle,
			description: description.trim(),
		});
	}

	function onTitleChange(event) {
		setTitle(event.target.value);
		if (titleInvalid) setTitleInvalid(false);
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-size-16">
			<label className="flex flex-col gap-size-6">
				<Text as="span" variant="body-12-medium" className="text-text-strong">
					Title
				</Text>
				<input
					ref={nameInputRef}
					type="text"
					placeholder="Enter playlist title..."
					value={title}
					onChange={onTitleChange}
					className={cn(
						'body-body-14-regular w-full rounded-ds-8 border bg-bg-surface px-size-12 py-size-10 text-text-strong outline-none transition-colors focus:border-border-input focus:ring-0',
						titleInvalid ? 'border-border-danger' : 'border-border-strong-constant'
					)}
				/>
				{titleInvalid && (
					<Text as="span" variant="body-12-regular" className="text-text-danger">
						Title is required.
					</Text>
				)}
			</label>

			<label className="flex flex-col gap-size-6">
				<Text as="span" variant="body-12-medium" className="text-text-strong">
					Description
				</Text>
				<textarea
					ref={descriptionInputRef}
					rows={3}
					placeholder="Enter playlist description..."
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					className="body-body-14-regular w-full resize-y rounded-ds-8 border border-border-strong-constant bg-bg-surface px-size-12 py-size-10 text-text-strong outline-none transition-colors focus:border-border-input focus:ring-0"
				/>
			</label>

			<div className="flex justify-end gap-size-8">
				<Button type="button" variant="secondary" size="sm" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" variant="primary" size="sm">
					Create
				</Button>
			</div>
		</form>
	);
}

PlaylistCreationForm.propTypes = {
	onCancel: PropTypes.func.isRequired,
	onPlaylistSave: PropTypes.func.isRequired,
};
