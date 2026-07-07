import { useEffect, useMemo, useRef } from 'react';
import Sortable from 'sortablejs';
import { Card } from '../../shared/components';
import { useMovePlaylistMediaMutation, useRemovePlaylistMediaMutation } from '../hooks/usePlaylistMediaMutations';
import { orderedPlaylistMedia } from '../utils/playlist';
import { FilmRow } from './FilmRow';

export function FilmList({ config, isOwner, media = [], onShare, playlistToken }) {
	const listRef = useRef(null);
	const orderedMedia = useMemo(() => orderedPlaylistMedia(media), [media]);
	const moveMutation = useMovePlaylistMediaMutation(playlistToken, config);
	const removeMutation = useRemovePlaylistMediaMutation(playlistToken, config);
	const { move } = moveMutation;

	useEffect(() => {
		if (!isOwner || !listRef.current || orderedMedia.length < 2) {
			return undefined;
		}

		const sortable = Sortable.create(listRef.current, {
			animation: 160,
			handle: '.playlist-drag-handle',
			chosenClass: 'bg-bg-surface-raised',
			onEnd: (event) => {
				const { from, item, newIndex, oldIndex } = event;
				if (oldIndex === newIndex) {
					return;
				}
				// Revert SortableJS's DOM move so React stays the owner of this
				// list; the optimistic cache update below performs the reorder.
				from.removeChild(item);
				from.insertBefore(item, from.children[oldIndex] ?? null);
				move(orderedMedia, oldIndex, newIndex);
			},
		});

		return () => sortable.destroy();
	}, [isOwner, move, orderedMedia]);

	function handleMove(fromIndex, toIndex) {
		move(orderedMedia, fromIndex, toIndex);
	}

	return (
		<Card as="section" className="overflow-visible rounded-ds-8">
			<div className="border-b border-border-divider px-4 py-5 sm:px-5">
				<h2 className="m-0 text-text-strong heading-h6-20-medium">All Videos ({orderedMedia.length})</h2>
			</div>

			{orderedMedia.length ? (
				<ul ref={listRef} className="@container m-0 list-none px-3 py-0 sm:px-5 lg:px-4">
					{orderedMedia.map((item, index) => (
						<FilmRow
							key={item.friendly_token || item.url || index}
							index={index}
							isOwner={isOwner}
							media={item}
							mediaCount={orderedMedia.length}
							onMove={handleMove}
							onRemove={(mediaToken) => removeMutation.mutate({ mediaToken })}
							onShare={onShare}
							playlistToken={playlistToken}
						/>
					))}
				</ul>
			) : (
				<div className="p-5">
					<p className="m-0 text-text-muted body-body-14-regular">
						{isOwner
							? 'Add videos to this playlist from a video page to start curating the program.'
							: 'This playlist does not have visible videos yet.'}
					</p>
				</div>
			)}
		</Card>
	);
}
