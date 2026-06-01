import React from 'react';
import { format } from 'timeago.js';
import { useMarkAsRead } from '../hooks/useMarkAsRead';
import { getBadgeForType } from '../notificationBadge';
import { Icon } from '../../shared/components/Icon';

const ITEM_THEMES = {
	dark: {
		readBg: 'bg-bg-surface',
		unreadBg: 'bg-bg-notification-unread',
		hoverBg: 'hover:bg-bg-surface-muted',
		avatarBg: 'bg-bg-surface-muted',
		badgeBorder: 'border-bg-surface',
		messageText: 'text-text-primary',
		metaText: 'text-text-muted',
		menuText: 'text-text-muted',
	},
	light: {
		readBg: 'bg-bg-surface',
		unreadBg: 'bg-bg-notification-unread',
		hoverBg: 'hover:bg-bg-surface-muted',
		avatarBg: 'bg-bg-surface-muted',
		badgeBorder: 'border-bg-surface',
		messageText: 'text-text-primary',
		metaText: 'text-text-muted',
		menuText: 'text-text-muted',
	},
};

function renderMessage(notification) {
	const actorName = notification.actor?.username;
	if (actorName && notification.message.startsWith(actorName)) {
		const rest = notification.message.slice(actorName.length);
		return (
			<>
				<span className="font-bold">{actorName}</span>
				{rest}
			</>
		);
	}
	return notification.message;
}

export function NotificationItem({ notification, theme = 'dark' }) {
	const { mutateAsync: markAsRead } = useMarkAsRead();
	const badge = getBadgeForType(notification.notification_type);
	const itemTheme = ITEM_THEMES[theme] ?? ITEM_THEMES.dark;

	async function handleClick() {
		const url = notification.action_url;
		if (!notification.is_read) {
			await markAsRead(notification.id).catch((err) => {
				console.error(`markAsRead failed for notification ${notification.id}`, err);
			});
		}
		if (url && url.startsWith('/') && !url.startsWith('//')) {
			window.location.href = url;
		}
	}

	const rowBg = notification.is_read ? itemTheme.readBg : itemTheme.unreadBg;

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleClick();
				}
			}}
			className={`relative flex min-h-[108px] cursor-pointer items-start gap-[16px] px-[22px] py-[16px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-focus ${rowBg} ${itemTheme.hoverBg}`}
		>
			<div className="relative shrink-0">
				<span className={`block h-[32px] w-[32px] overflow-hidden rounded-full ${itemTheme.avatarBg}`}>
					{notification.actor?.thumbnail_url ? (
						<img src={notification.actor.thumbnail_url} alt="" className="h-full w-full object-cover" />
					) : (
						<span className="flex h-full w-full items-center justify-center bg-bg-avatar-fallback text-[14px] font-semibold leading-none text-text-avatar-fallback">
							{(notification.actor?.username ?? '?').slice(0, 2).toUpperCase()}
						</span>
					)}
				</span>
				{badge ? (
					<span
						aria-hidden="true"
						className={`absolute left-[8px] top-[20px] flex h-[32px] w-[32px] items-center justify-center rounded-full border-[3px] ${itemTheme.badgeBorder} ${badge.bgClass}`}
					>
						<Icon name={badge.icon} size={18} decorative />
					</span>
				) : null}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-[8px]">
				<p className={`m-0 max-w-[325px] text-[16px] leading-[24px] tracking-normal ${itemTheme.messageText}`}>
					{renderMessage(notification)}
				</p>
				<p className={`m-0 text-[14px] leading-[20px] tracking-normal ${itemTheme.metaText}`}>
					{format(notification.created_at)}
				</p>
			</div>
			<i
				className={`material-icons shrink-0 ${itemTheme.menuText}`}
				aria-hidden="true"
				style={{ fontSize: '22px' }}
			>
				more_vert
			</i>
		</div>
	);
}
