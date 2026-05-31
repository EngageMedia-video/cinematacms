export const NOTIFICATION_BADGES = {
	comment: { icon: 'commentBlue', bgClass: 'bg-bg-badge-info' },
	reply: { icon: 'commentBlue', bgClass: 'bg-bg-badge-info' },
	mention: { icon: 'commentBlue', bgClass: 'bg-bg-badge-info' },
	like: { icon: 'thumbsUpRed', bgClass: 'bg-bg-badge-danger' },
	added_to_playlist: { icon: 'addedFavorite', bgClass: 'bg-bg-badge-accent' },
	follow: { icon: 'followUser', bgClass: 'bg-bg-badge-info' },
	new_media: { icon: 'recentlyUpload', bgClass: 'bg-bg-badge-muted' },
	system_announcement: { icon: 'notificationBell', bgClass: 'bg-bg-badge-muted' },
	media_report: { icon: 'infoCircle', bgClass: 'bg-bg-badge-danger' },
};

export function getBadgeForType(type) {
	return NOTIFICATION_BADGES[type] ?? null;
}
