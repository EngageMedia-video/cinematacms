import React, { useContext } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import UserContext from '../../../static/js/contexts/UserContext';
import { Icon } from '../../shared/components/Icon';
import { useUnreadCount } from '../../notifications/hooks/useUnreadCount';
import { NotificationDropdown } from '../../notifications/components/NotificationDropdown';
import useNotificationStore from '../../notifications/useNotificationStore';
import notificationQueryClient from '../../notifications/queryClient';

function BellButton() {
	const { data } = useUnreadCount();
	const { isDropdownOpen, toggleDropdown } = useNotificationStore();
	const count = data?.unread_count ?? 0;

	return (
		<div className="relative inline-flex items-center">
			<button
				type="button"
				onClick={toggleDropdown}
				aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
				aria-haspopup="true"
				aria-expanded={isDropdownOpen}
				className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-cinemata-pacific-deep-800 hover:bg-cinemata-pacific-deep-700 transition-colors shrink-0 text-cinemata-strait-blue-50"
			>
				<Icon name="notificationBell" size={24} decorative />
				{count > 0 ? (
					<span
						aria-hidden="true"
						className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cinemata-red-500 rounded-full pointer-events-none ring-2 ring-cinemata-pacific-deep-900"
					/>
				) : null}
			</button>
			{isDropdownOpen ? <NotificationDropdown /> : null}
		</div>
	);
}

export function TopbarNotificationButton() {
	const user = useContext(UserContext);

	if (!user || user.is?.anonymous) {
		return null;
	}

	return (
		<QueryClientProvider client={notificationQueryClient}>
			<BellButton />
		</QueryClientProvider>
	);
}
