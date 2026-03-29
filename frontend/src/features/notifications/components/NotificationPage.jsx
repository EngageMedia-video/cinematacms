import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import notificationQueryClient from '../queryClient';

function NotificationPageContent() {
    const [page, setPage] = useState(1);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    const { data, isLoading } = useNotifications({
        pageSize: 20,
        page,
        is_read: showUnreadOnly ? false : undefined,
    });
    const { mutate: markAllAsRead, isPending } = useMarkAllAsRead();

    const notifications = data?.results ?? [];

    return (
        <div className="max-w-2xl mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold text-content-body">Notifications</h1>
                <button
                    onClick={() => markAllAsRead()}
                    disabled={isPending}
                    className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-50"
                >
                    {isPending ? 'Marking…' : 'Mark all as read'}
                </button>
            </div>

            <div className="flex gap-3 mb-4">
                {[
                    { label: 'All', active: !showUnreadOnly, onClick: () => { setShowUnreadOnly(false); setPage(1); } },
                    { label: 'Unread', active: showUnreadOnly, onClick: () => { setShowUnreadOnly(true); setPage(1); } },
                ].map(({ label, active, onClick }) => (
                    <button
                        key={label}
                        onClick={onClick}
                        className={`border cursor-pointer text-sm px-4 py-1.5 rounded-md transition-all ${active ? 'bg-brand-primary/15 text-brand-primary border-brand-primary ring-1 ring-brand-primary/30 shadow-sm font-medium' : 'bg-transparent text-content-body border-border-input hover:bg-surface-popup'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="bg-surface-popup rounded border border-border-input divide-y divide-border-input/40">
                {isLoading && (
                    <p className="px-4 py-8 text-sm text-center text-content-body/60">Loading…</p>
                )}
                {!isLoading && notifications.length === 0 && (
                    <p className="px-4 py-8 text-sm text-center text-content-body/60">No notifications</p>
                )}
                {notifications.map((n) => (
                    <NotificationItem key={n.id} notification={n} />
                ))}
            </div>

            {(data?.previous || data?.next) && (
                <div className="flex justify-between mt-4">
                    <button
                        onClick={() => setPage((p) => p - 1)}
                        disabled={!data?.previous}
                        className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!data?.next}
                        className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

export default function NotificationPage() {
    return (
        <QueryClientProvider client={notificationQueryClient}>
            <NotificationPageContent />
        </QueryClientProvider>
    );
}
