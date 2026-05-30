import { useRef } from 'react';
import { cn } from '../../shared/utils/classNames';
import { useComments } from '../hooks/useComments';
import { useHiddenBelowCount } from '../hooks/useHiddenBelowCount';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

function CommentsTab({ count }) {
	return (
		<div className="flex shrink-0 items-start overflow-hidden rounded-t-lg">
			<span
				className="bg-bg-surface px-4 py-3 text-xs font-bold uppercase leading-5 tracking-tight text-text-strong"
				aria-current="page"
			>
				Comments ({count})
			</span>
		</div>
	);
}

function ScrollMorePill({ count, onClick }) {
	if (count <= 0) return null;
	return (
		<button
			type="button"
			onClick={onClick}
			className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-bg-secondary px-2.5 py-1 text-xs font-bold tracking-tight text-text-on-primary shadow-md transition-colors duration-200 hover:bg-bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
		>
			<i aria-hidden="true" className="material-icons" style={{ fontSize: 14 }}>
				arrow_downward
			</i>
			<span>{count} MORE</span>
		</button>
	);
}

export function CommentsPanel({ friendlyToken, variant = 'inline', onExpandToggle, isExpanded = false }) {
	const showTabs = variant === 'sidebar';
	const isModal = variant === 'modal';
	const { data, isLoading, isError, refetch } = useComments(friendlyToken);
	const comments = Array.isArray(data?.results) ? data.results : [];
	const loadedCount = comments.length;
	const totalCount = typeof data?.count === 'number' ? data.count : loadedCount;

	const scrollRef = useRef(null);
	const hiddenBelow = useHiddenBelowCount(scrollRef, loadedCount);

	const handleScrollToBottom = () => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
	};

	return (
		<section
			aria-label="Comments"
			className={cn(
				'flex w-full flex-col gap-4',
				variant === 'sidebar' && 'max-h-[706px] lg:max-h-[calc(100vh-7rem)] lg:sticky lg:top-24',
				isModal && 'h-full'
			)}
		>
			<div className="relative flex min-h-0 flex-1 flex-col">
				{showTabs ? <CommentsTab count={totalCount} /> : null}

				<div
					ref={scrollRef}
					className={cn(
						'comments-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-surface px-4 pb-4',
						showTabs ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg'
					)}
				>
					<div className="sticky top-0 z-20 -mx-4 shrink-0 bg-bg-surface px-4 pt-[22px]">
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 flex-col gap-2">
								<h2 className="m-0 font-heading text-xl font-medium leading-6 text-text-strong">
									Write a Comment
								</h2>
								<p className="m-0 text-sm leading-5 tracking-tight text-text-muted">
									Here is what everyone else is saying, let’s hear yours
								</p>
							</div>
							{onExpandToggle ? (
								<button
									type="button"
									onClick={onExpandToggle}
									aria-label={isExpanded ? 'Close expanded comments' : 'Expand comments'}
									className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-bg-primary text-text-on-primary transition-colors duration-200 hover:bg-bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
								>
									<i aria-hidden="true" className="material-icons" style={{ fontSize: 20 }}>
										{isExpanded ? 'close_fullscreen' : 'open_in_full'}
									</i>
								</button>
							) : null}
						</div>

						<div className="mt-[26px] border-t border-border-default" aria-hidden="true" />
					</div>

					{isLoading ? (
						<p className="py-4 text-center text-sm text-text-muted">Loading comments…</p>
					) : isError ? (
						<div className="mt-3 rounded-md border border-border-danger bg-bg-surface-raised px-3 py-2 text-sm text-text-danger">
							Could not load comments.{' '}
							<button
								type="button"
								onClick={() => refetch()}
								className="ml-1 cursor-pointer border-0 bg-transparent p-0 font-bold text-text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-sm"
							>
								Retry
							</button>
						</div>
					) : loadedCount === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">No comments yet.</p>
					) : (
						<ul className="flex list-none flex-col divide-y divide-border-default pl-0">
							{comments.map((c, idx) => (
								<li
									key={c.uid}
									className={cn(
										'py-[26px]',
										idx === 0 && 'pt-[26px]',
										idx === loadedCount - 1 && 'pb-0'
									)}
								>
									<CommentItem
										comment={c}
										friendlyToken={friendlyToken}
										showTrail={idx < loadedCount - 1}
									/>
								</li>
							))}
						</ul>
					)}
				</div>

				<ScrollMorePill count={hiddenBelow} onClick={handleScrollToBottom} />
			</div>

			<CommentForm friendlyToken={friendlyToken} />
		</section>
	);
}
