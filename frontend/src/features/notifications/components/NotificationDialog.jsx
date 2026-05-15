import { Children } from 'react';
import { cn } from '../../shared/utils/classNames';

export function NotificationDialog({
	children,
	className = '',
	emptyMessage = 'No notifications',
	isLoading = false,
	isMarkAllAsReadPending = false,
	loadingMessage = 'Loading…',
	onMarkAllAsRead,
	seeAllHref = '/notifications/',
	seeAllLabel = 'See All Notifications',
	title = 'Notifications',
	ref,
}) {
	const hasItems = Children.count(children) > 0;

	return (
		<div
			ref={ref}
			role="dialog"
			className={cn(
				'absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-border-input/40 bg-surface-popup shadow-lg',
				className
			)}
		>
			<div className="flex items-center justify-between border-b border-border-input/20 px-4 py-2.5">
				<span className="text-base font-bold text-content-body">{title}</span>
				<button
					type="button"
					onClick={onMarkAllAsRead}
					disabled={isMarkAllAsReadPending}
					className="cursor-pointer border-0 bg-transparent p-0 text-xs text-content-body/60 transition-colors hover:text-content-body disabled:opacity-50"
				>
					{isMarkAllAsReadPending ? 'Marking…' : 'Mark all as read'}
				</button>
			</div>

			<div className="max-h-96 overflow-y-auto divide-y divide-border-input/15">
				{isLoading ? (
					<p className="px-4 py-6 text-center text-sm text-content-body/60">{loadingMessage}</p>
				) : null}
				{!isLoading && !hasItems ? (
					<p className="px-4 py-6 text-center text-sm text-content-body/60">{emptyMessage}</p>
				) : null}
				{!isLoading && hasItems ? children : null}
			</div>

			<div className="flex items-center justify-center border-t border-border-input/20 px-4 py-2.5">
				<a
					href={seeAllHref}
					className="text-sm font-bold text-content-body no-underline transition-colors hover:text-content-body/80"
				>
					{seeAllLabel}
				</a>
			</div>
		</div>
	);
}
