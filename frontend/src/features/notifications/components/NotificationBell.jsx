import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { NotificationDropdown } from './NotificationDropdown';
import useNotificationStore from '../useNotificationStore';
import notificationQueryClient from '../queryClient';

function BellIcon() {
	const { data } = useUnreadCount();
	const { isDropdownOpen, toggleDropdown } = useNotificationStore();
	const count = data?.unread_count ?? 0;

	return (
		<div className="relative inline-flex items-center">
			<div className="relative">
				<button
					type="button"
					onClick={toggleDropdown}
					className="circle-icon-button"
					aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
				>
					<span>
						<span>
							<i className="material-icons">notifications</i>
						</span>
					</span>
				</button>
				{count > 0 && (
					<span
						className="absolute top-0 right-1 min-w-[16px] h-4 bg-site-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none"
						aria-hidden="true"
					>
						{count > 99 ? '99+' : count}
					</span>
				)}
			</div>
			{isDropdownOpen && <NotificationDropdown />}
		</div>
	);
}

export function NotificationBell() {
	return (
		<QueryClientProvider client={notificationQueryClient}>
			<BellIcon />
		</QueryClientProvider>
	);
}
