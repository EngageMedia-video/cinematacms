import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components';
import { formatDuration } from '../../shared/utils/formatDuration';
import { addPlaylistParam, formatCount, getMediaCountry, getMediaDescription } from '../utils/playlist';

function useCloseOnOutside(open, close) {
	const ref = useRef(null);

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		function handlePointerDown(event) {
			if (!ref.current?.contains(event.target)) {
				close();
			}
		}

		function handleEscape(event) {
			if (event.key === 'Escape') {
				close();
			}
		}

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [close, open]);

	return ref;
}

function FilmRowMenu({ index, isOwner, media, mediaCount, mediaUrl, onMove, onRemove, onShare }) {
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);
	const menuRef = useCloseOnOutside(open, close);
	const title = media?.title || 'video';

	function run(action) {
		action();
		close();
	}

	return (
		<div ref={menuRef} className="relative shrink-0">
			<button
				type="button"
				aria-label={`More actions for ${title}`}
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ds-4 border border-transparent bg-transparent text-text-secondary hover:bg-bg-surface-hover hover:text-text-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
			>
				<span aria-hidden="true" className="text-[22px] leading-none">
					⋮
				</span>
			</button>

			{open ? (
				<div
					role="group"
					aria-label={`Actions for ${title}`}
					className="absolute right-0 z-20 mt-2 flex w-[220px] flex-col overflow-hidden rounded-ds-8 border border-border-strong-constant bg-bg-surface py-2 shadow-2xl"
				>
					{isOwner ? (
						<>
							<button
								type="button"
								disabled={index === 0}
								onClick={() => run(() => onMove(index, index - 1))}
								className="min-h-11 cursor-pointer border-0 bg-transparent px-4 text-left text-text-strong hover:bg-bg-surface-hover focus:bg-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:text-text-disabled body-body-14-regular"
							>
								Move up
							</button>
							<button
								type="button"
								disabled={index === mediaCount - 1}
								onClick={() => run(() => onMove(index, index + 1))}
								className="min-h-11 cursor-pointer border-0 bg-transparent px-4 text-left text-text-strong hover:bg-bg-surface-hover focus:bg-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:text-text-disabled body-body-14-regular"
							>
								Move down
							</button>
							<button
								type="button"
								onClick={() => run(() => onRemove(media.friendly_token))}
								className="min-h-11 cursor-pointer border-0 bg-transparent px-4 text-left text-text-danger hover:bg-bg-danger-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-regular"
							>
								Remove from playlist
							</button>
						</>
					) : null}
					<button
						type="button"
						onClick={() => run(() => onShare(mediaUrl))}
						className="min-h-11 cursor-pointer border-0 bg-transparent px-4 text-left text-text-strong hover:bg-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-regular"
					>
						Share video
					</button>
					<a
						href={mediaUrl}
						className="min-h-11 px-4 py-3 text-text-strong no-underline hover:bg-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-regular"
					>
						Open video
					</a>
				</div>
			) : null}
		</div>
	);
}

function RowOrderCell({ index, isOwner, title }) {
	if (!isOwner) {
		return <span className="w-6 text-center text-text-muted body-body-14-regular">{index + 1}</span>;
	}

	return (
		<button
			type="button"
			className="playlist-drag-handle flex min-h-11 w-6 cursor-grab flex-col items-center justify-center gap-1 rounded-ds-4 border-0 bg-transparent p-0 text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus active:cursor-grabbing"
			aria-label={`Drag to reorder ${title}. Use the row menu for Move up and Move down.`}
		>
			<span aria-hidden="true" className="body-body-14-regular">
				{index + 1}
			</span>
			<Icon
				name="menu"
				size="xs"
				decorative
				className="text-text-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
			/>
		</button>
	);
}

export function FilmRow({ index, isOwner, media, mediaCount, onMove, onRemove, onShare, playlistToken }) {
	const mediaUrl = addPlaylistParam(media?.url, playlistToken);
	const title = media?.title || 'Untitled video';
	const author = media?.author_name || media?.user || 'Cinemata member';
	const country = getMediaCountry(media);
	const description = getMediaDescription(media);
	const duration = formatDuration(media?.duration);
	const metadata = [country, formatCount(media?.views || 0, 'view')].filter(Boolean).join(' · ');

	return (
		<li
			data-media-token={media?.friendly_token}
			className="group grid grid-cols-[minmax(0,1fr)_44px] gap-x-2 gap-y-3 rounded-ds-4 border-b border-border-divider py-4 last:border-b-0 @2xl:grid-cols-[24px_180px_minmax(140px,0.8fr)_minmax(0,1.2fr)_28px] @2xl:items-center @2xl:gap-x-4 @2xl:py-5 @4xl:grid-cols-[24px_220px_200px_minmax(0,1fr)_28px] @4xl:gap-x-5"
		>
			<div className="hidden @2xl:flex @2xl:justify-center @2xl:self-center">
				<RowOrderCell index={index} isOwner={isOwner} title={title} />
			</div>

			<div className="col-start-1 flex min-w-0 gap-3 @2xl:contents">
				<a
					href={mediaUrl}
					className="relative block aspect-video w-[152px] shrink-0 overflow-hidden rounded-ds-6 bg-bg-skeleton no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus min-[420px]:w-[171px] @2xl:w-[180px] @4xl:w-[220px]"
					aria-label={`Open ${title}`}
				>
					{media?.thumbnail_url ? (
						<img
							src={media.thumbnail_url}
							alt=""
							width="344"
							height="194"
							loading="lazy"
							decoding="async"
							className="h-full w-full object-cover"
						/>
					) : (
						<span className="flex h-full w-full items-center justify-center text-text-muted body-body-12-regular">
							No thumbnail
						</span>
					)}
					{duration ? (
						<span className="absolute right-1 bottom-1 rounded-ds-2 bg-bg-overlay-dark/80 px-1 py-0.5 text-text-on-chrome body-body-12-medium">
							{duration}
						</span>
					) : null}
				</a>

				<div className="flex min-w-0 flex-1 flex-col gap-3">
					<a
						href={mediaUrl}
						className="line-clamp-3 wrap-break-word text-text-strong no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-16-medium"
					>
						{title}
					</a>
					<div className="flex min-w-0 flex-col gap-2">
						<a
							href={media?.author_profile || '#'}
							className="line-clamp-2 w-fit text-text-link no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-12-regular"
						>
							{author}
						</a>
						{metadata ? <p className="m-0 text-text-muted body-body-12-regular">{metadata}</p> : null}
					</div>
				</div>
			</div>

			<div className="col-span-2 min-w-0 @2xl:col-span-1">
				<p className="m-0 mb-3 text-text-muted body-body-14-regular">Synopsis</p>
				{description ? (
					<p className="m-0 line-clamp-6 break-words text-text-primary body-body-14-regular @2xl:line-clamp-3">
						{description}
					</p>
				) : (
					<p className="m-0 text-text-muted body-body-14-regular">No synopsis available.</p>
				)}
			</div>

			<div className="col-start-2 row-start-1 justify-self-end @2xl:col-start-auto @2xl:row-start-auto @2xl:self-center">
				<FilmRowMenu
					index={index}
					isOwner={isOwner}
					media={media}
					mediaCount={mediaCount}
					mediaUrl={mediaUrl}
					onMove={onMove}
					onRemove={onRemove}
					onShare={onShare}
				/>
			</div>
		</li>
	);
}
