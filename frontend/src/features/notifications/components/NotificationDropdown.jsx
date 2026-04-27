import React, { useRef, useEffect } from 'react';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import useNotificationStore from '../useNotificationStore';

export function NotificationDropdown() {
	const { data, isLoading } = useNotifications({ pageSize: 10 });
	const { mutate: markAllAsRead, isPending } = useMarkAllAsRead();
	const closeDropdown = useNotificationStore((s) => s.closeDropdown);
	const ref = useRef(null);

	useEffect(() => {
		function handleClickOutside(e) {
			if (ref.current && !ref.current.contains(e.target)) {
				closeDropdown();
			}
		}
		function handleEscape(e) {
			if (e.key === 'Escape') closeDropdown();
		}
		// Delay to avoid the triggering click immediately closing the dropdown
		const frameId = requestAnimationFrame(() => {
			document.addEventListener('click', handleClickOutside);
			document.addEventListener('keydown', handleEscape);
		});
		return () => {
			cancelAnimationFrame(frameId);
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [closeDropdown]);

	const notifications = data?.results ?? [];

	return (
		<div
			ref={ref}
			className="absolute right-0 top-full mt-1 w-80 bg-surface-popup rounded-lg shadow-lg z-50 overflow-hidden border border-border-input/40"
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2.5 border-b border-border-input/20">
				<span className="text-base font-bold text-content-body">Notifications</span>
				<button
					type="button"
					onClick={() => markAllAsRead()}
					disabled={isPending}
					className="text-xs text-content-body/60 hover:text-content-body border-0 bg-transparent p-0 cursor-pointer transition-colors disabled:opacity-50"
				>
					{isPending ? 'Marking…' : 'Mark all as read'}
				</button>
			</div>

			{/* Notification list */}
			<div className="max-h-96 overflow-y-auto divide-y divide-border-input/15">
				{isLoading && <p className="px-4 py-6 text-sm text-center text-content-body/60">Loading…</p>}
				{!isLoading && notifications.length === 0 && (
					<p className="px-4 py-6 text-sm text-center text-content-body/60">No notifications</p>
				)}
				{notifications.map((n) => (
					<NotificationItem key={n.id} notification={n} />
				))}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-center px-4 py-2.5 border-t border-border-input/20">
				<a
					href="/notifications/"
					className="text-sm font-bold text-content-body hover:text-content-body/80 no-underline transition-colors"
				>
					See All Notifications
				</a>
			</div>
		</div>
	);
}
