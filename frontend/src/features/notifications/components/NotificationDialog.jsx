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
	unreadCount = 0,
	ref,
}) {
	const hasItems = Children.count(children) > 0;

	const markAllColor =
		unreadCount > 0
			? 'text-cinemata-strait-blue-100 hover:text-cinemata-sunset-horizon-300'
			: 'text-cinemata-neutral-600';

	return (
		<div
			ref={ref}
			role="dialog"
			aria-label={title}
			className={cn(
				'absolute right-0 top-full z-50 mt-1 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[8px] bg-cinemata-pacific-deep-900 text-cinemata-strait-blue-50 shadow-lg',
				className
			)}
		>
			<div className="flex items-center justify-between px-[16px] pt-[14px] pb-[16px]">
				<div className="flex items-center gap-1.5">
					<span className="font-heading text-[16px] font-medium leading-5 text-cinemata-strait-blue-50">
						{title}
					</span>
					<span className="font-heading text-[16px] font-medium leading-5 text-cinemata-red-500">
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				</div>
				<button
					type="button"
					onClick={onMarkAllAsRead}
					disabled={isMarkAllAsReadPending || unreadCount === 0}
					className={cn(
						'cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[12px] font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed',
						markAllColor
					)}
				>
					{isMarkAllAsReadPending ? 'Marking…' : 'Mark all as read'}
				</button>
			</div>

			<div className="notif-scrollbar max-h-[22rem] overflow-y-auto">
				{isLoading ? (
					<div className="flex h-[108px] w-full items-center justify-center">
						<p className="text-[12px] font-medium leading-4 text-cinemata-neutral-600">{loadingMessage}</p>
					</div>
				) : null}
				{!isLoading && !hasItems ? (
					<div className="flex h-[108px] w-full items-center justify-center">
						<p className="text-[12px] font-medium leading-4 text-cinemata-neutral-600">{emptyMessage}</p>
					</div>
				) : null}
				{!isLoading && hasItems ? <div className="flex w-full flex-col">{children}</div> : null}
			</div>

			<div className="h-px w-full bg-cinemata-pacific-deep-700/60" aria-hidden="true" />

			<div className="px-[16px] pt-[16px] pb-[14px]">
				<a
					href={seeAllHref}
					className="rounded-sm text-[12px] font-medium leading-4 text-cinemata-strait-blue-100 no-underline transition-colors hover:text-cinemata-sunset-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
				>
					{seeAllLabel}
				</a>
			</div>

			<style>{`
				.notif-scrollbar {
					scrollbar-color: var(--cinemata-strait-blue-200) transparent;
					scrollbar-width: thin;
				}
				.notif-scrollbar::-webkit-scrollbar {
					width: 6px;
				}
				.notif-scrollbar::-webkit-scrollbar-track {
					background: transparent;
				}
				.notif-scrollbar::-webkit-scrollbar-thumb {
					border: 2px solid transparent;
					border-radius: 999px;
					background-color: var(--cinemata-strait-blue-200);
					background-clip: content-box;
				}
			`}</style>
		</div>
	);
}
