import React, { useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import notificationQueryClient from '../queryClient';
import { NotificationPreferencesForm } from '../../user-settings/components/NotificationPreferencesForm';

const TAB_ALL = 'all';
const TAB_UNREAD = 'unread';
const TAB_IDS = [TAB_ALL, TAB_UNREAD];
const HASH_PREFERENCES = 'preferences';

function readTabFromHash() {
	if (typeof window === 'undefined') return TAB_ALL;
	const hash = window.location.hash.replace(/^#/, '');
	if (hash === TAB_UNREAD) return TAB_UNREAD;
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

	return (
		<div className="bg-notification-surface py-[22px]">
			<div className="overflow-hidden">
				{isLoading ? (
					<p className="m-0 px-[22px] py-8 text-center text-[14px] leading-5 text-notification-muted">
						Loading…
					</p>
				) : null}
				{!isLoading && notifications.length === 0 ? (
					<p className="m-0 px-[22px] py-8 text-center text-[14px] leading-5 text-notification-muted">
						No notifications
					</p>
				) : null}
				{!isLoading && notifications.length > 0 ? (
					<div className="flex flex-col">
						{notifications.map((n) => (
							<NotificationItem key={n.id} notification={n} theme="light" />
						))}
					</div>
				) : null}
			</div>

			{(data?.previous || data?.next) && (
				<div className="flex justify-between px-[22px] pt-[22px]">
					<button
						type="button"
						onClick={() => setPage((p) => p - 1)}
						disabled={!data?.previous}
						className="cursor-pointer border-0 bg-transparent p-0 text-sm text-text-link hover:text-text-link-hover hover:underline disabled:cursor-not-allowed disabled:opacity-40"
					>
						← Previous
					</button>
					<button
						type="button"
						onClick={() => setPage((p) => p + 1)}
						disabled={!data?.next}
						className="cursor-pointer border-0 bg-transparent p-0 text-sm text-text-link hover:text-text-link-hover hover:underline disabled:cursor-not-allowed disabled:opacity-40"
					>
						Next →
					</button>
				</div>
			)}
		</div>
	);
}

function NotificationPageContent() {
	const [activeTab, setActiveTab] = useState(readTabFromHash);
	const { data: unread } = useUnreadCount();
	const { mutate: markAllAsRead, isPending } = useMarkAllAsRead();
	const tabRefs = useRef({});
	const preferencesRef = useRef(null);
	const unreadCount = unread?.unread_count ?? 0;

	function scrollPreferencesIntoView() {
		window.requestAnimationFrame(() => {
			preferencesRef.current?.scrollIntoView({ block: 'start' });
		});
	}

	useEffect(() => {
		const onHashChange = () => {
			if (window.location.hash.replace(/^#/, '') === HASH_PREFERENCES) {
				scrollPreferencesIntoView();
				return;
			}
			setActiveTab(readTabFromHash());
		};
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const currentHash = window.location.hash.replace(/^#/, '');
		if (currentHash === HASH_PREFERENCES) {
			scrollPreferencesIntoView();
			return;
		}
		if (currentHash && currentHash !== TAB_UNREAD) {
			const nextUrl = `${window.location.pathname}${window.location.search}`;
			window.history.replaceState(null, '', nextUrl);
		}
	}, []);

	function selectTab(tab) {
		if (tab === activeTab) return;
		setActiveTab(tab);
		const nextHash = tab === TAB_ALL ? '' : `#${tab}`;
		const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
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
		{ id: TAB_ALL, label: 'ALL' },
		{ id: TAB_UNREAD, label: unreadCount > 0 ? `UNREAD (${unreadCount})` : 'UNREAD' },
	];

	return (
		<div className="mx-auto max-w-[1054px] px-4 py-6 lg:px-0">
			<div className="grid grid-cols-1 gap-[26px] lg:grid-cols-[minmax(0,622px)_406px] lg:items-start">
				<section aria-label="Notification list">
					<div className="flex w-full items-center justify-between">
						<div
							role="tablist"
							aria-label="Notifications views"
							className="inline-flex items-start overflow-hidden rounded-t-[8px]"
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
										className={`cursor-pointer border-0 text-[14px] font-bold uppercase leading-5 tracking-normal shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus ${
											active
												? 'bg-notification-tab-active px-[22px] py-[12px] text-notification-tab-active-text'
												: 'bg-notification-tab-inactive px-[16px] py-[12px] text-notification-tab-inactive-text hover:bg-notification-tab-inactive-hover'
										}`}
										style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}
									>
										{label}
									</button>
								);
							})}
						</div>
						<button
							type="button"
							onClick={() => markAllAsRead()}
							disabled={isPending || unreadCount === 0}
							className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-medium leading-5 tracking-normal text-notification-action hover:text-notification-action-hover disabled:cursor-not-allowed disabled:text-notification-action-disabled"
							style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
						>
							{isPending ? 'Marking…' : 'Mark All as Read'}
						</button>
					</div>
					<div
						role="tabpanel"
						id={`panel-${activeTab}`}
						aria-labelledby={`tab-${activeTab}`}
						className="overflow-hidden rounded-bl-[8px] rounded-br-[8px] rounded-tr-[8px] bg-notification-surface"
					>
						<NotificationList
							key={activeTab === TAB_UNREAD ? 'unread' : 'all'}
							showUnreadOnly={activeTab === TAB_UNREAD}
						/>
					</div>
				</section>

				<aside
					id={HASH_PREFERENCES}
					ref={preferencesRef}
					aria-label="Notification preferences"
					className="scroll-mt-6 rounded-[8px] bg-notification-surface px-[16px] pb-[16px] pt-[22px]"
				>
					<NotificationPreferencesForm />
				</aside>
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
