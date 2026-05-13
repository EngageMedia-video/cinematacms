import React, { useEffect, useState } from 'react';

import { Icon } from '../../shared/components/Icon';
import { TopbarUploadButton } from './TopbarUploadButton';

function isHome() {
	if (typeof window === 'undefined') return false;
	return window.location.pathname === '/' || window.location.pathname === '';
}

// Pathname → title map (first match wins). Profile sub-routes use the section name, not the username.
const ROUTE_TITLES = [
	[/^\/$/, 'Home'],
	[/^\/featured\/?$/, 'Featured'],
	[/^\/recommended\/?$/, 'Popular'],
	[/^\/latest\/?$/, 'Recent uploads'],
	[/^\/liked\/?$/, 'My favorites'],
	[/^\/history\/?$/, 'My history'],
	[/^\/categories(\/.*)?$/, 'Categories'],
	[/^\/topics(\/.*)?$/, 'Topics'],
	[/^\/languages(\/.*)?$/, 'Languages'],
	[/^\/countries(\/.*)?$/, 'Countries'],
	[/^\/tags(\/.*)?$/, 'Tags'],
	[/^\/members\/?$/, 'Members'],
	[/^\/search\/?$/, 'Search'],
	[/^\/upload\/?$/, 'Upload media'],
	[/^\/about\/?$/, 'About'],
	[/^\/contact\/?$/, 'Contact'],
	[/^\/help\/?$/, 'Help'],
	[/^\/editorial-policy\/?$/, 'Editorial policy'],
	[/^\/blog(\/.*)?$/, 'Blog'],
	[/^\/voices(\/.*)?$/, 'Curator Voices'],
	[/^\/user\/[^/]+\/media\/?$/, 'Media'],
	[/^\/user\/[^/]+\/playlists\/?$/, 'Playlists'],
	[/^\/user\/[^/]+\/about\/?$/, 'Profile'],
	[/^\/user\/[^/]+\/?$/, 'Profile'],
	[/^\/edit-channel\/?$/, 'Edit channel'],
	[/^\/edit-profile\/?$/, 'Edit profile'],
	[/^\/manage\/media\/?$/, 'Manage media'],
	[/^\/manage\/users\/?$/, 'Manage users'],
	[/^\/manage\/comments\/?$/, 'Manage comments'],
	[/^\/manage\/uploads\/?$/, 'Manage uploads'],
	[/^\/view\b/, 'Watch'],
	[/^\/playlist\//, 'Playlist'],
];

function derivePageTitle() {
	if (typeof window === 'undefined') return 'Home';
	const path = window.location.pathname || '/';
	for (const [pattern, label] of ROUTE_TITLES) {
		if (pattern.test(path)) return label;
	}
	const raw = (typeof document !== 'undefined' && document.title) || '';
	const first = raw.split(/[-|–—]/)[0].trim();
	return first || 'Home';
}

export function TopbarMobileBar() {
	const [title, setTitle] = useState(derivePageTitle);
	const [home, setHome] = useState(isHome);

	useEffect(() => {
		const observer = new MutationObserver(() => {
			setTitle(derivePageTitle());
			setHome(isHome());
		});
		const titleEl = document.querySelector('title');
		if (titleEl) {
			observer.observe(titleEl, { childList: true });
		}
		return () => observer.disconnect();
	}, []);

	function onBack() {
		if (typeof window !== 'undefined' && window.history?.length > 1) {
			window.history.back();
		}
	}

	return (
		<div className="flex sm:hidden items-center justify-between gap-3 px-4 h-16 bg-cinemata-pacific-deep-900">
			{home ? (
				<span aria-hidden="true" className="w-10 h-10 shrink-0" />
			) : (
				<button
					type="button"
					onClick={onBack}
					aria-label="Go back"
					className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-cinemata-pacific-deep-800 text-cinemata-white hover:bg-cinemata-pacific-deep-700 transition-colors shrink-0"
				>
					<Icon name="chevronLeft" size={20} decorative />
				</button>
			)}
			<h1 className="flex-1 text-xl font-bold text-cinemata-white truncate">{title}</h1>
			<TopbarUploadButton compact />
		</div>
	);
}
