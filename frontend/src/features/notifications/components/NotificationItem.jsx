import React from 'react';
import { format } from 'timeago.js';
import { useMarkAsRead } from '../hooks/useMarkAsRead';
import '../../../static/css/tailwind.css';

function renderMessage(notification) {
	const actorName = notification.actor?.username;
	if (actorName && notification.message.startsWith(actorName)) {
		const rest = notification.message.slice(actorName.length);
		return (
			<>
				<strong>{actorName}</strong>
				{rest}
			</>
		);
	}
	return notification.message;
}

export function NotificationItem({ notification }) {
	const { mutateAsync: markAsRead } = useMarkAsRead();

	async function handleClick() {
		const url = notification.action_url;
		if (!notification.is_read) {
			try {
				await markAsRead(notification.id);
			} catch {
				// Navigate regardless of mark-read failure
			}
		}
		// Guard: only navigate to relative internal URLs to prevent open redirect
		if (url && url.startsWith('/') && !url.startsWith('//')) {
			window.location.href = url;
		}
	}

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
			className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-surface-popup/50 ${
				!notification.is_read ? 'bg-brand-theme/5' : ''
			}`}
		>
			<span className="w-10 h-10 rounded-full bg-surface-popup flex items-center justify-center flex-shrink-0 overflow-hidden">
				{notification.actor?.thumbnail_url ? (
					<img src={notification.actor.thumbnail_url} alt="" className="w-full h-full object-cover" />
				) : (
					<i className="material-icons text-lg text-content-body">person</i>
				)}
			</span>
			<div className="flex-1 min-w-0">
				<p className="text-sm text-content-body leading-snug">{renderMessage(notification)}</p>
				<p className="text-xs text-content-body/50 mt-0.5">{format(notification.created_at)}</p>
			</div>
			{!notification.is_read && (
				<span className="w-2 h-2 rounded-full bg-brand-theme flex-shrink-0" aria-hidden="true" />
			)}
		</div>
	);
}
