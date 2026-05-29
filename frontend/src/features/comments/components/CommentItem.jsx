import { useState, useRef, useEffect } from 'react';
import { format as formatTimeago } from 'timeago.js';
import { CommentText } from './CommentText';
import { useDeleteComment } from '../hooks/useDeleteComment';
import { gradientForName, initialFor } from '../utils/avatar';

function getUser() {
	if (typeof window === 'undefined') return null;
	return window.MediaCMS?.user ?? null;
}

function canDelete(_comment, user) {
	if (!user || user.is?.anonymous) return false;
	return user.can?.deleteComment === true;
}

function formatPostedRel(addDate) {
	if (!addDate) return '';
	try {
		return formatTimeago(new Date(addDate));
	} catch {
		return '';
	}
}

function formatTimeOfDay(addDate) {
	if (!addDate) return '';
	try {
		const d = new Date(addDate);
		const h = d.getHours();
		const mins = d.getMinutes();
		const am = h < 12;
		const h12 = h % 12 === 0 ? 12 : h % 12;
		return `${h12}:${String(mins).padStart(2, '0')}${am ? 'AM' : 'PM'}`;
	} catch {
		return '';
	}
}

function Avatar({ name, thumbnail }) {
	if (thumbnail) {
		return <img src={thumbnail} alt="" className="h-8 w-8 rounded-full object-cover" />;
	}
	const { from, to } = gradientForName(name);
	return (
		<span
			aria-hidden="true"
			className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
			style={{ background: `linear-gradient(to bottom, ${from}, ${to})` }}
		>
			{initialFor(name)}
		</span>
	);
}

export function CommentItem({ comment, friendlyToken, showTrail = true }) {
	const user = getUser();
	const allowDelete = canDelete(comment, user);
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const deleteMutation = useDeleteComment(friendlyToken);
	const menuRef = useRef(null);

	useEffect(() => {
		if (!menuOpen) return undefined;
		const close = () => {
			setMenuOpen(false);
			setConfirmingDelete(false);
		};
		const onDocClick = (event) => {
			if (!menuRef.current || menuRef.current.contains(event.target)) return;
			close();
		};
		const onKey = (event) => {
			if (event.key === 'Escape') close();
		};
		document.addEventListener('mousedown', onDocClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDocClick);
			document.removeEventListener('keydown', onKey);
		};
	}, [menuOpen]);

	const toggleMenu = () => {
		if (menuOpen) {
			setMenuOpen(false);
			setConfirmingDelete(false);
		} else {
			setMenuOpen(true);
		}
	};

	const handleDeleteClick = () => {
		if (!confirmingDelete) {
			setConfirmingDelete(true);
			return;
		}
		deleteMutation.mutate(comment.uid, {
			onSettled: () => {
				setConfirmingDelete(false);
				setMenuOpen(false);
			},
		});
	};

	const postedRelative = formatPostedRel(comment.add_date);
	const postedClock = formatTimeOfDay(comment.add_date);

	return (
		<div data-comment className="flex gap-4 items-start">
			<div className="flex flex-col items-center gap-1.5 self-stretch shrink-0">
				<Avatar name={comment.author_name} thumbnail={comment.author_thumbnail_url} />
				{showTrail ? (
					<span aria-hidden="true" className="w-px flex-1 min-h-[16px] bg-border-default opacity-60" />
				) : null}
			</div>

			<div className="flex flex-1 min-w-0 gap-3 items-start">
				<div className="flex flex-col gap-1.5 min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						{comment.author_profile ? (
							<a
								href={comment.author_profile}
								className="text-sm leading-5 text-text-muted no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-sm"
							>
								{comment.author_name || 'User'}
							</a>
						) : (
							<span className="text-sm leading-5 text-text-muted">{comment.author_name || 'User'}</span>
						)}
						{comment.author_is_manager ? (
							<span className="inline-flex items-center rounded-sm bg-cinemata-sunset-horizon-600 px-1.5 py-0.5 text-[12px] leading-4 font-bold uppercase text-white">
								Moderator
							</span>
						) : null}
					</div>

					<p className="m-0 text-base leading-6 text-text-primary">
						<CommentText text={comment.text} />
					</p>

					<div className="flex items-center gap-2 text-sm leading-5 text-text-muted">
						{postedRelative ? <span>{postedRelative}</span> : null}
						{postedRelative && postedClock ? (
							<span
								aria-hidden="true"
								className="inline-block h-1 w-1 rounded-full bg-text-muted opacity-70"
							/>
						) : null}
						{postedClock ? <span>{postedClock}</span> : null}
					</div>

					{deleteMutation.isError ? (
						<p className="text-xs text-text-danger">Could not delete comment. Please try again.</p>
					) : null}
				</div>

				{allowDelete ? (
					<div className="relative shrink-0" ref={menuRef}>
						<button
							type="button"
							aria-label="Comment options"
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							onClick={toggleMenu}
							className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-text-muted hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
						>
							<i aria-hidden="true" className="material-icons" style={{ fontSize: 22 }}>
								more_vert
							</i>
						</button>
						{menuOpen ? (
							<div
								role="menu"
								className="absolute right-0 top-[26px] z-10 min-w-[140px] rounded-md border border-border-default bg-bg-surface-raised py-1 shadow-lg"
							>
								<button
									type="button"
									role="menuitem"
									onClick={handleDeleteClick}
									disabled={deleteMutation.isPending}
									className="block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-sm text-text-strong hover:bg-bg-surface-muted focus-visible:outline-none focus-visible:bg-bg-surface-muted disabled:opacity-50"
								>
									{deleteMutation.isPending
										? 'Deleting…'
										: confirmingDelete
											? 'Confirm delete'
											: 'Delete'}
								</button>
								{confirmingDelete && !deleteMutation.isPending ? (
									<button
										type="button"
										role="menuitem"
										onClick={() => setConfirmingDelete(false)}
										className="block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-sm text-text-muted hover:bg-bg-surface-muted focus-visible:outline-none focus-visible:bg-bg-surface-muted"
									>
										Cancel
									</button>
								) : null}
							</div>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
