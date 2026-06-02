import React, { useRef, useEffect } from 'react';
import { NotificationDialog } from './NotificationDialog';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import { useUnreadCount } from '../hooks/useUnreadCount';
import useNotificationStore from '../useNotificationStore';

export function NotificationDropdown() {
	const { data, isLoading } = useNotifications({ pageSize: 10 });
	const { data: unread } = useUnreadCount();
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
		<NotificationDialog
			onMarkAllAsRead={() => markAllAsRead()}
			isMarkAllAsReadPending={isPending}
			isLoading={isLoading}
			unreadCount={unread?.unread_count ?? 0}
			ref={ref}
		>
			{notifications.map((n) => (
				<NotificationItem key={n.id} notification={n} />
			))}
		</NotificationDialog>
	);
}
