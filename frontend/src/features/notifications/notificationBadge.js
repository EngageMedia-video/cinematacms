export const NOTIFICATION_BADGES = {
	comment: { icon: 'commentBlue', bgClass: 'bg-notification-badge-blue' },
	reply: { icon: 'commentBlue', bgClass: 'bg-notification-badge-blue' },
	mention: { icon: 'commentBlue', bgClass: 'bg-notification-badge-blue' },
	like: { icon: 'thumbsUpRed', bgClass: 'bg-notification-badge-danger' },
	added_to_playlist: { icon: 'addedFavorite', bgClass: 'bg-notification-badge-accent' },
	follow: { icon: 'followUser', bgClass: 'bg-notification-badge-blue' },
	new_media: { icon: 'recentlyUpload', bgClass: 'bg-notification-badge-muted' },
	system_announcement: { icon: 'notificationBell', bgClass: 'bg-notification-badge-muted' },
	media_report: { icon: 'infoCircle', bgClass: 'bg-notification-badge-danger' },
};

export function getBadgeForType(type) {
	return NOTIFICATION_BADGES[type] ?? null;
}
