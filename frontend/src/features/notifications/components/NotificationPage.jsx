import React, { useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import notificationQueryClient from '../queryClient';
import { NotificationPreferencesForm } from '../../user-settings/components/NotificationPreferencesForm';

const TAB_ALL = 'all';
const TAB_UNREAD = 'unread';
const TAB_PREFERENCES = 'preferences';
const TAB_IDS = [TAB_ALL, TAB_UNREAD, TAB_PREFERENCES];

function readTabFromHash() {
	if (typeof window === 'undefined') return TAB_ALL;
	const hash = window.location.hash.replace(/^#/, '');
	if (hash === TAB_UNREAD || hash === TAB_PREFERENCES) return hash;
	return TAB_ALL;
}

function NotificationList({ showUnreadOnly }) {
	// `page` state is intentionally local: NotificationList is remounted via
	// `key` when the filter changes (see parent), so the reset happens
	// naturally without a useEffect that would double-fetch.
	const [page, setPage] = useState(1);
	const { data, isLoading } = useNotifications({
		pageSize: 20,
		page,
		is_read: showUnreadOnly ? false : undefined,
	});
	const notifications = data?.results ?? [];

	return (
		<>
			<div className="bg-surface-popup rounded border border-border-input divide-y divide-border-input/40">
				{isLoading && <p className="px-4 py-8 text-sm text-center text-content-body/60">Loading…</p>}
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
	const tabRefs = useRef({});

	useEffect(() => {
		const onHashChange = () => setActiveTab(readTabFromHash());
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	}, []);

	useEffect(() => {
		// Normalize stale/unknown hashes on mount so the URL matches the
		// resolved tab (e.g. arriving with `#foo` lands on All but previously
		// left `#foo` in the address bar, blocking future hashchange events
		// when the user explicitly navigates back to `#foo`).
		if (typeof window === 'undefined') return;
		const resolved = readTabFromHash();
		const currentHash = window.location.hash.replace(/^#/, '');
		const expectedHash = resolved === TAB_ALL ? '' : resolved;
		if (currentHash !== expectedHash) {
			const nextHash = expectedHash ? `#${expectedHash}` : '';
			const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
			window.history.replaceState(null, '', nextUrl);
		}
	}, []);

	function selectTab(tab) {
		// Clicking the already-active tab is a no-op: no state update and
		// crucially no pushState, which would otherwise litter history with
		// duplicate entries and make the Back button "go back" to the same tab.
		if (tab === activeTab) return;
		setActiveTab(tab);
		const nextHash = tab === TAB_ALL ? '' : `#${tab}`;
		const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
		// pushState so the browser Back button steps through tabs as users
		// expect. The mount-time normalization above uses replaceState instead,
		// to avoid polluting history with a redundant entry on page load.
		window.history.pushState(null, '', nextUrl);
	}

	function focusTab(tab) {
		const el = tabRefs.current[tab];
		if (el) el.focus();
	}

	function handleTabKeyDown(e) {
		const idx = TAB_IDS.indexOf(activeTab);
		if (idx === -1) return;
		let nextIdx = null;
		switch (e.key) {
			case 'ArrowRight':
				nextIdx = (idx + 1) % TAB_IDS.length;
				break;
			case 'ArrowLeft':
				nextIdx = (idx - 1 + TAB_IDS.length) % TAB_IDS.length;
				break;
			case 'Home':
				nextIdx = 0;
				break;
			case 'End':
				nextIdx = TAB_IDS.length - 1;
				break;
			default:
				return;
		}
		e.preventDefault();
		const nextTab = TAB_IDS[nextIdx];
		selectTab(nextTab);
		focusTab(nextTab);
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
			<div
				role="tablist"
				aria-label="Notifications views"
				className="inline-flex gap-1 rounded-full p-1 mb-6 bg-surface-popup border border-border-input"
				style={{ boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}
			>
				{tabs.map(({ id, label }) => {
					const active = activeTab === id;
					return (
						<button
							key={id}
							ref={(el) => {
								tabRefs.current[id] = el;
							}}
							type="button"
							role="tab"
							id={`tab-${id}`}
							aria-selected={active}
							aria-controls={`panel-${id}`}
							tabIndex={active ? 0 : -1}
							onClick={() => selectTab(id)}
							onKeyDown={handleTabKeyDown}
							className="cursor-pointer transition-all"
							style={{
								padding: '5px 16px',
								borderRadius: '9999px',
								border: 'none',
								fontSize: '13px',
								fontWeight: 500,
								...(active
									? {
											backgroundColor: 'var(--btn-primary-bg-color)',
											color: '#fff',
											boxShadow: '0 1px 3px rgba(0,0,0,.2)',
										}
									: {
											backgroundColor: 'transparent',
											color: 'var(--body-text-color)',
											opacity: 0.6,
										}),
							}}
						>
							{label}
						</button>
					);
				})}
			</div>

			<div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
				{activeTab === TAB_PREFERENCES ? (
					<NotificationPreferencesForm />
				) : (
					// Remount the list (and reset its `page` state) whenever
					// the filter flips, so we don't issue a stale-page fetch
					// followed by a second fetch after a useEffect reset.
					<NotificationList
						key={activeTab === TAB_UNREAD ? 'unread' : 'all'}
						showUnreadOnly={activeTab === TAB_UNREAD}
					/>
				)}
			</div>
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
