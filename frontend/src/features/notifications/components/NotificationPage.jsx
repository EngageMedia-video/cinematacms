import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import notificationQueryClient from '../queryClient';
import { NotificationPreferencesForm } from '../../user-settings/components/NotificationPreferencesForm';

const TAB_ALL = 'all';
const TAB_UNREAD = 'unread';
const TAB_PREFERENCES = 'preferences';

function readTabFromHash() {
    if (typeof window === 'undefined') return TAB_ALL;
    const hash = window.location.hash.replace(/^#/, '');
    if (hash === TAB_UNREAD || hash === TAB_PREFERENCES) return hash;
    return TAB_ALL;
}

function NotificationList({ showUnreadOnly }) {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useNotifications({
        pageSize: 20,
        page,
        is_read: showUnreadOnly ? false : undefined,
    });
    const notifications = data?.results ?? [];

    useEffect(() => { setPage(1); }, [showUnreadOnly]);

    return (
        <>
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
                        type="button"
                        onClick={() => setPage((p) => p - 1)}
                        disabled={!data?.previous}
                        className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!data?.next}
                        className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            )}
        </>
    );
}

function NotificationPageContent() {
    const [activeTab, setActiveTab] = useState(readTabFromHash);
    const { mutate: markAllAsRead, isPending } = useMarkAllAsRead();

    useEffect(() => {
        const onHashChange = () => setActiveTab(readTabFromHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    function selectTab(tab) {
        setActiveTab(tab);
        const nextHash = tab === TAB_ALL ? '' : `#${tab}`;
        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        window.history.replaceState(null, '', nextUrl);
    }

    const tabs = [
        { id: TAB_ALL, label: 'All' },
        { id: TAB_UNREAD, label: 'Unread' },
        { id: TAB_PREFERENCES, label: 'Preferences' },
    ];

    return (
        <div className="max-w-2xl mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold text-content-body">Notifications</h1>
                {activeTab !== TAB_PREFERENCES && (
                    <button
                        type="button"
                        onClick={() => markAllAsRead()}
                        disabled={isPending}
                        className="border-0 bg-transparent p-0 cursor-pointer text-sm text-content-link hover:underline disabled:opacity-50"
                    >
                        {isPending ? 'Marking…' : 'Mark all as read'}
                    </button>
                )}
            </div>

            {/* Inline styles on buttons are required because global _buttons.scss
                overrides Tailwind @layer utilities for background-color, color,
                padding, border-radius, and font properties on all button elements. */}
            <div className="inline-flex gap-1 rounded-full p-1 mb-6 bg-surface-popup border border-border-input" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}>
                {tabs.map(({ id, label }) => {
                    const active = activeTab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => selectTab(id)}
                            aria-pressed={active}
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
                    );
                })}
            </div>

            {activeTab === TAB_PREFERENCES ? (
                <NotificationPreferencesForm />
            ) : (
                <NotificationList showUnreadOnly={activeTab === TAB_UNREAD} />
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
