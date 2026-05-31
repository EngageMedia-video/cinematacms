import React, { useContext } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import UserContext from '../../../static/js/contexts/UserContext';
import { Icon } from '../../shared/components/Icon';
import { useUnreadCount } from '../../notifications/hooks/useUnreadCount';
import { NotificationDropdown } from '../../notifications/components/NotificationDropdown';
import useNotificationStore from '../../notifications/useNotificationStore';
import notificationQueryClient from '../../notifications/queryClient';
import { TopbarIconButton } from './TopbarIconButton';

function BellButton() {
	const { data } = useUnreadCount();
	const { isDropdownOpen, toggleDropdown } = useNotificationStore();
	const count = data?.unread_count ?? 0;

	return (
		<div className="relative inline-flex items-center">
			<TopbarIconButton
				onClick={toggleDropdown}
				aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
				aria-haspopup="true"
				aria-expanded={isDropdownOpen}
				className="relative text-text-on-chrome"
			>
				<Icon name="notificationBell" size={20} decorative />
				{count > 0 ? (
					<span
						aria-hidden="true"
						className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-bg-danger rounded-full pointer-events-none ring-2 ring-bg-overlay-dark"
					/>
				) : null}
			</TopbarIconButton>
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
