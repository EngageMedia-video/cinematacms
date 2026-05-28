import { useRef } from 'react';
import { cn } from '../../shared/utils/classNames';
import { useComments } from '../hooks/useComments';
import { useHiddenBelowCount } from '../hooks/useHiddenBelowCount';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

function ScrollMorePill({ count, onClick }) {
	if (count <= 0) return null;
	return (
		<button
			type="button"
			onClick={onClick}
			className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-cinemata-sunset-horizon-500 px-2.5 py-1 text-xs font-bold tracking-tight text-white shadow-md transition-colors duration-200 hover:bg-cinemata-sunset-horizon-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
		>
			<i aria-hidden="true" className="material-icons" style={{ fontSize: 14 }}>
				arrow_downward
			</i>
			<span>{count} MORE</span>
		</button>
	);
}

/**
 * Comments panel. Two stacked rounded blocks:
 *  - (sidebar variant only) Tab pill on top with the comment count. The
 *    modal/expand variant omits the tab.
 *  - List panel (theme-aware): heading + subtitle + expand toggle, divider,
 *    then the comment list with vertical-trail avatars.
 *  - Form panel — kept on dark navy in both themes so the input stands apart
 *    from the surrounding chrome — rendered by `<CommentForm />`.
 *  - "X MORE" pill appears above the form when comments are hidden below the
 *    visible scroll viewport; clicking it smooth-scrolls to the bottom.
 */
export function CommentsPanel({ friendlyToken, variant = 'inline', onExpandToggle, isExpanded = false }) {
	const showTabs = variant === 'sidebar';
	const { data, isLoading, isError, refetch } = useComments(friendlyToken);
	const comments = Array.isArray(data) ? data : [];
	const count = comments.length;

	const scrollRef = useRef(null);
	const hiddenBelow = useHiddenBelowCount(scrollRef, count);

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
				variant === 'sidebar' && 'lg:max-h-[calc(100vh-7rem)] lg:sticky lg:top-24',
				variant === 'modal' && 'h-full'
			)}
		>
			{/* List panel (with optional tab strip on top in sidebar variant) */}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{showTabs ? (
					<div className="flex shrink-0 items-start">
						<span
							className="rounded-t-lg bg-bg-surface px-3.5 py-2 text-xs font-bold uppercase leading-4 tracking-tight text-text-strong"
							aria-current="page"
						>
							Comments ({count})
						</span>
					</div>
				) : null}

				<div
					ref={scrollRef}
					className={cn(
						'comments-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-surface px-3 pb-4 pt-3',
						showTabs ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg'
					)}
				>
					{/* Header row */}
					<div className="flex shrink-0 items-start justify-between gap-3">
						<div className="flex min-w-0 flex-col">
							<h2 className="font-heading text-lg font-medium leading-tight text-text-strong">
								Write a Comment
							</h2>
							<p className="text-xs leading-tight tracking-tight text-text-muted">
								Here is what everyone else is saying, let’s hear yours
							</p>
						</div>
						{onExpandToggle ? (
							<button
								type="button"
								onClick={onExpandToggle}
								aria-label={isExpanded ? 'Close expanded comments' : 'Expand comments'}
								className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-cinemata-strait-blue-400 text-white transition-colors duration-200 hover:bg-cinemata-strait-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
							>
								<i aria-hidden="true" className="material-icons" style={{ fontSize: 18 }}>
									{isExpanded ? 'close_fullscreen' : 'open_in_full'}
								</i>
							</button>
						) : null}
					</div>

					<div className="mt-2 border-t border-border-default" aria-hidden="true" />

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
					) : count === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">No comments yet.</p>
					) : (
						<ul className="flex list-none flex-col divide-y divide-border-default pl-0">
							{comments.map((c, idx) => (
								<li
									key={c.uid}
									className={cn('py-3', idx === 0 && 'pt-3', idx === count - 1 && 'pb-0')}
								>
									<CommentItem
										comment={c}
										friendlyToken={friendlyToken}
										showTrail={idx < count - 1}
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
