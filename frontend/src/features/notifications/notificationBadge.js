export const NOTIFICATION_BADGES = {
	comment: { icon: 'commentBlue', bgClass: 'bg-cinemata-strait-blue-900' },
	reply: { icon: 'commentBlue', bgClass: 'bg-cinemata-strait-blue-900' },
	mention: { icon: 'commentBlue', bgClass: 'bg-cinemata-strait-blue-900' },
	like: { icon: 'thumbsUpRed', bgClass: 'bg-cinemata-red-950' },
	added_to_playlist: { icon: 'addedFavorite', bgClass: 'bg-cinemata-sunset-horizon-800' },
	follow: { icon: 'followUser', bgClass: 'bg-cinemata-strait-blue-900' },
	new_media: { icon: 'recentlyUpload', bgClass: 'bg-cinemata-pacific-deep-700' },
	system_announcement: { icon: 'notificationBell', bgClass: 'bg-cinemata-pacific-deep-700' },
	media_report: { icon: 'infoCircle', bgClass: 'bg-cinemata-red-950' },
};

export function getBadgeForType(type) {
	return NOTIFICATION_BADGES[type] ?? null;
}
