function firstName(author) {
	return (author.name || author.username || 'Member').trim().split(/\s+/)[0];
}

export function getProfileTabs(author, runtimeConfig) {
	const name = firstName(author);
	const username = encodeURIComponent(author.username);
	const base = `/user/${username}`;
	const owner = Boolean(author.is_owner);
	const member = runtimeConfig.member;
	const profileOptions = runtimeConfig.options?.pages?.profile || {};

	return [
		{
			id: 'about',
			label: 'About',
			heading: `About ${name}`,
			subtext: `${name}'s biography, background, and contact details.`,
			href: base,
			visible: true,
		},
		{
			id: 'media',
			label: `${name}'s Media`,
			heading: 'Uploaded Films',
			subtext: `${name} has uploaded ${author.media_count || 0} films.`,
			href: `${base}/media`,
			visible: true,
		},
		{
			id: 'manage-uploads',
			label: 'Manage Uploads',
			heading: 'Manage Your Uploads',
			subtext: 'Edit details, visibility, and settings for your uploaded films.',
			href: `${base}/uploads`,
			visible: owner && member.can.manageUploads,
		},
		{
			id: 'playlists',
			label: 'Playlists',
			heading: 'Created Playlists',
			subtext: `${name} has created ${author.playlist_count || 0} playlists.`,
			href: `${base}/playlists`,
			visible: member.can.saveMedia,
		},
		{
			id: 'notes',
			label: 'My Notes',
			heading: 'Your Notes',
			subtext: 'Your private, time-stamped notes on films across Cinemata.',
			href: `${base}/notes`,
			visible: owner,
		},
		{
			id: 'impact',
			label: 'Impact',
			heading: 'Community Impact',
			subtext: `Screenings, courses, and campaigns where ${name}'s films have been used.`,
			href: `${base}/impact`,
			visible: true,
		},
		{
			id: 'history',
			label: 'Viewing History',
			heading: 'Watching History',
			subtext: "Films you've watched on Cinemata.",
			href: `${base}/history`,
			visible: owner && profileOptions.includeHistory,
		},
		{
			id: 'liked',
			label: 'My Favorites',
			heading: 'Liked Films',
			subtext: "Films you've liked on Cinemata.",
			href: `${base}/liked`,
			visible: owner && profileOptions.includeLikedMedia,
		},
	].filter((tab) => tab.visible);
}
