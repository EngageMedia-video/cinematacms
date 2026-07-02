import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { config as mediacmsConfig } from '../../../static/js/mediacms/config';
import { Button, Card, Icon, UserRoleBadge } from '../../shared/components';
import { useDeletePlaylistMutation } from '../hooks/useDeletePlaylistMutation';
import { usePlaylistQuery } from '../hooks/usePlaylistQuery';
import usePlaylistUiStore from '../store/usePlaylistUiStore';
import {
	addPlaylistParam,
	formatCount,
	formatCreatedDate,
	getPlaylistPageUrl,
	getPlaylistTokenFromLocation,
	getPlaylistViews,
	isOwnerPlaylist,
} from '../utils/playlist';
import { CuratorNoteDialog } from './CuratorNoteDialog';
import { FilmList } from './FilmList';
import { ReadMore } from './ReadMore';

function getRuntimeConfig() {
	return mediacmsConfig(window.MediaCMS || {});
}

function LoadingState() {
	return (
		<div className="flex min-h-[320px] items-center justify-center rounded-ds-8 bg-bg-surface text-text-muted body-body-14-regular">
			Loading playlist
		</div>
	);
}

function ErrorState() {
	return (
		<div className="rounded-ds-8 border border-border-default bg-bg-surface p-6 text-text-strong">
			<h1 className="m-0 heading-h6-20-medium">Playlist unavailable</h1>
			<p className="mt-2 mb-0 text-text-muted body-body-14-regular">
				This playlist could not be loaded. Refresh the page or try again later.
			</p>
		</div>
	);
}

function CoverCard({ mobileActions = null, onShare, playlist, playlistToken }) {
	const media = playlist.playlist_media || [];
	const firstMedia = media[0];
	const imageUrl = playlist.composite_thumbnail_url || playlist.thumbnail_url || firstMedia?.thumbnail_url;
	const playAllUrl = addPlaylistParam(firstMedia?.url, playlistToken);
	const views = getPlaylistViews(media);

	return (
		<Card className="overflow-hidden rounded-ds-8">
			<div className="p-3 pb-0 sm:p-[22px] sm:pb-0">
				<div className="relative aspect-[325/194] overflow-hidden rounded-ds-6 bg-bg-skeleton">
					{imageUrl ? (
						<img
							src={imageUrl}
							alt=""
							width="650"
							height="388"
							loading="eager"
							decoding="async"
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-text-muted body-body-14-regular">
							No playlist cover
						</div>
					)}

					<a
						href={playAllUrl}
						className="absolute inset-x-0 bottom-0 inline-flex h-[31%] max-h-20 min-h-12 items-center justify-center gap-2 bg-bg-overlay-dark/80 text-text-on-chrome no-underline hover:bg-bg-overlay-dark/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-medium"
					>
						<Icon name="playSolid" size="sm" decorative />
						PLAY ALL
					</a>
				</div>
			</div>
			<div className="flex flex-col gap-2 px-3 pt-3 pb-4 sm:px-[22px] sm:pt-4 sm:pb-[15px]">
				<h2 className="m-0 text-text-strong body-body-16-medium">{playlist.title}</h2>
				<p className="m-0 text-text-muted body-body-12-regular">
					{formatCreatedDate(playlist.add_date)} · {formatCount(views, 'view')}
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-3 lg:hidden">
					<Button
						size="sm"
						icon={<Icon name="shareMedia" size="sm" decorative />}
						onClick={() => onShare()}
						className="w-fit focus-visible:ring-2 focus-visible:ring-ring-focus"
					>
						Share
					</Button>
					{mobileActions}
				</div>
			</div>
		</Card>
	);
}

function AboutCuratorCard({ playlist }) {
	return (
		<Card className="flex flex-col rounded-ds-8 p-5 sm:p-[22px]">
			<h2 className="order-2 m-0 mt-4 text-text-strong heading-h6-20-medium lg:order-1 lg:mt-0">
				About the Curator
			</h2>
			<div className="order-1 flex items-start gap-4 lg:order-2 lg:mt-5">
				<div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg-avatar-fallback">
					{playlist.user_thumbnail_url ? (
						<img
							src={playlist.user_thumbnail_url}
							alt=""
							width="40"
							height="40"
							loading="lazy"
							decoding="async"
							className="h-full w-full object-cover"
						/>
					) : (
						<span className="flex h-full w-full items-center justify-center text-text-avatar-fallback body-body-14-bold">
							{(playlist.user || '?').slice(0, 1).toUpperCase()}
						</span>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="m-0 text-text-muted body-body-14-regular">Playlist Curated by</p>
					<p className="mt-1 mb-0 text-text-strong body-body-16-medium">
						{playlist.user_display_name || playlist.user}
					</p>
					<UserRoleBadge isTrusted={playlist.author_is_trusted} isManager={playlist.author_is_manager} />
				</div>
			</div>
			{playlist.description ? (
				<ReadMore
					id="playlist-description"
					text={playlist.description}
					charBudget={260}
					colorClassName="text-text-description"
					className="order-3 mt-4"
				/>
			) : (
				<p className="order-3 mt-4 mb-0 text-text-muted body-body-14-regular">No curator introduction yet.</p>
			)}
		</Card>
	);
}

function CuratorNoteCard({ isOwner, playlist }) {
	const setOpen = usePlaylistUiStore((state) => state.setCuratorNoteDialogOpen);
	const hasNote = Boolean(playlist.curator_note);

	if (!hasNote && !isOwner) {
		return null;
	}

	return (
		<Card className="rounded-ds-8 p-5 sm:p-[22px]">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="m-0 text-text-strong heading-h6-20-medium">Curator's Notes</h2>
				{isOwner ? (
					<Button
						variant="text"
						size="sm"
						onClick={() => setOpen(true)}
						className="w-fit focus-visible:ring-2 focus-visible:ring-ring-focus"
					>
						{hasNote ? 'Edit' : 'Add curator note'}
					</Button>
				) : null}
			</div>
			{hasNote ? (
				<ReadMore
					id="playlist-curator-note"
					text={playlist.curator_note}
					charBudget={320}
					colorClassName="text-text-description"
					className="mt-3"
				/>
			) : (
				<p className="mt-4 mb-0 text-text-muted body-body-14-regular">
					Add editorial framing to help viewers understand this program.
				</p>
			)}
		</Card>
	);
}

function DeletePlaylistButton({ onDelete, playlistTitle }) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<Button
			variant={confirmingDelete ? 'primary' : 'text'}
			size="sm"
			icon={<Icon name="trash" size="sm" decorative />}
			onClick={() => {
				if (confirmingDelete) {
					onDelete();
					return;
				}
				setConfirmingDelete(true);
			}}
			onBlur={() => setConfirmingDelete(false)}
			aria-label={
				confirmingDelete ? `Confirm delete playlist ${playlistTitle}` : `Delete playlist ${playlistTitle}`
			}
			className="focus-visible:ring-2 focus-visible:ring-ring-focus"
		>
			{confirmingDelete ? 'Confirm delete' : 'Delete'}
		</Button>
	);
}

function HeaderActions({ isOwner, onDelete, onShare, playlist }) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
			<Button
				size="sm"
				icon={<Icon name="shareMedia" size="sm" decorative />}
				onClick={() => onShare()}
				className="focus-visible:ring-2 focus-visible:ring-ring-focus"
			>
				Share
			</Button>
			{isOwner ? <DeletePlaylistButton onDelete={onDelete} playlistTitle={playlist.title} /> : null}
		</div>
	);
}

function ShareStatusToast({ message }) {
	if (!message || typeof document === 'undefined') {
		return null;
	}

	// Portal to <body>: .page-main-wrap sets will-change, which creates a
	// containing block that would hijack this fixed-position toast.
	return createPortal(
		<div
			role="status"
			className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-ds-8 border border-border-strong-constant bg-bg-surface px-4 py-3 text-text-strong shadow-2xl body-body-14-medium"
		>
			{message}
		</div>,
		document.body
	);
}

function PlaylistContent({ config, playlist, playlistToken }) {
	const isOwner = isOwnerPlaylist(config, playlist);
	const deleteMutation = useDeletePlaylistMutation(playlistToken, config);
	const [shareMessage, setShareMessage] = useState('');
	const playlistUrl = getPlaylistPageUrl(config, playlistToken);

	useEffect(() => {
		if (!shareMessage) {
			return undefined;
		}

		const timeout = setTimeout(() => setShareMessage(''), 3000);
		return () => clearTimeout(timeout);
	}, [shareMessage]);

	async function handleShare(url = playlistUrl) {
		const shareUrl = url || playlistUrl;
		try {
			if (navigator.share && shareUrl === playlistUrl) {
				await navigator.share({ title: playlist.title, url: shareUrl });
				setShareMessage('Share sheet opened.');
				return;
			}
			await navigator.clipboard.writeText(shareUrl);
			setShareMessage('Link copied.');
		} catch {
			setShareMessage('Copy the page URL from your browser to share.');
		}
	}

	return (
		<div className="min-h-screen bg-bg-page px-3 py-3 text-text-primary sm:px-6 lg:px-[26px] lg:py-[36px]">
			<div className="mx-auto flex w-full max-w-[1628px] flex-col gap-6">
				<header className="hidden flex-col gap-4 lg:flex lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<h1 className="m-0 text-text-strong heading-h6-20-medium">{playlist.title}</h1>
					</div>
					<HeaderActions
						isOwner={isOwner}
						onDelete={() => deleteMutation.mutate()}
						onShare={handleShare}
						playlist={playlist}
					/>
				</header>

				<div className="grid grid-cols-1 gap-3 lg:grid-cols-[369px_minmax(0,1fr)] lg:gap-4">
					<aside className="flex flex-col gap-3 lg:gap-6">
						<CoverCard
							mobileActions={
								isOwner ? (
									<DeletePlaylistButton
										onDelete={() => deleteMutation.mutate()}
										playlistTitle={playlist.title}
									/>
								) : null
							}
							onShare={handleShare}
							playlist={playlist}
							playlistToken={playlistToken}
						/>
						<AboutCuratorCard playlist={playlist} />
					</aside>

					<div className="flex min-w-0 flex-col gap-3 lg:gap-4">
						<CuratorNoteCard isOwner={isOwner} playlist={playlist} />
						<FilmList
							config={config}
							isOwner={isOwner}
							media={playlist.playlist_media || []}
							onShare={handleShare}
							playlistToken={playlistToken}
						/>
					</div>
				</div>
			</div>
			{isOwner ? <CuratorNoteDialog config={config} playlist={playlist} token={playlistToken} /> : null}
			<ShareStatusToast message={shareMessage} />
		</div>
	);
}

export function PlaylistPage() {
	const config = useMemo(() => getRuntimeConfig(), []);
	const playlistToken = useMemo(() => getPlaylistTokenFromLocation(), []);
	const { data, isLoading, isError } = usePlaylistQuery(playlistToken, config);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-bg-page p-4 sm:p-6 lg:p-8">
				<LoadingState />
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="min-h-screen bg-bg-page p-4 sm:p-6 lg:p-8">
				<ErrorState />
			</div>
		);
	}

	return <PlaylistContent config={config} playlist={data} playlistToken={playlistToken} />;
}
