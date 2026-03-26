import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { NotificationDropdown } from './NotificationDropdown';
import useNotificationStore from '../stores/useNotificationStore';
import notificationQueryClient from '../queryClient';

function BellIcon() {
    const { data } = useUnreadCount();
    const { isDropdownOpen, toggleDropdown } = useNotificationStore();
    const count = data?.unread_count ?? 0;

    return (
        <div className="relative inline-flex">
            <button
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
                    className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-brand-theme text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none"
                    aria-hidden="true"
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
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
