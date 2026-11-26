const NOTIFICATION_BADGES = {
	comment: { icon: 'commentBlue', bgClass: 'bg-bg-info-strong' },
	reply: { icon: 'commentBlue', bgClass: 'bg-bg-info-strong' },
	mention: { icon: 'commentBlue', bgClass: 'bg-bg-info-strong' },
	like: { icon: 'thumbsUpRed', bgClass: 'bg-bg-danger-strong' },
	added_to_playlist: { icon: 'addedFavorite', bgClass: 'bg-bg-secondary-strong' },
	follow: { icon: 'followUser', bgClass: 'bg-bg-info-strong' },
	new_media: { icon: 'recentlyUpload', bgClass: 'bg-bg-chrome-hover' },
	system_announcement: { icon: 'notificationBell', bgClass: 'bg-bg-chrome-hover' },
	media_report: { icon: 'infoCircle', bgClass: 'bg-bg-danger-strong' },
};

export function getBadgeForType(type) {
	return NOTIFICATION_BADGES[type] ?? null;
}
