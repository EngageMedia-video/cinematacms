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

            {/* Inline styles on buttons are required because global _buttons.scss
                overrides Tailwind @layer utilities for background-color, color,
                padding, border-radius, and font properties on all button elements. */}
            <div className="inline-flex gap-1 rounded-full p-1 mb-6 bg-surface-popup border border-border-input" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}>
                {[
                    { label: 'All', active: !showUnreadOnly, onClick: () => { setShowUnreadOnly(false); setPage(1); } },
                    { label: 'Unread', active: showUnreadOnly, onClick: () => { setShowUnreadOnly(true); setPage(1); } },
                ].map(({ label, active, onClick }) => (
                    <button
                        key={label}
                        onClick={onClick}
                        className="cursor-pointer transition-all"
                        style={{
                            padding: '5px 16px',
                            borderRadius: '9999px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 500,
                            ...(active
                                ? { backgroundColor: 'var(--btn-primary-bg-color)', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }
                                : { backgroundColor: 'transparent', color: 'var(--body-text-color)', opacity: 0.55 }),
                        }}
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
