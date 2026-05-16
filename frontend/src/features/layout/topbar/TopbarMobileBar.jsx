import React, { useEffect, useState } from 'react';

import { Icon } from '../../shared/components/Icon';
import { Text } from '../../shared/components/Text';
import { TopbarUploadButton } from './TopbarUploadButton';
import { useSidebarVisible } from './useSidebarVisible';

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
	const sidebarVisible = useSidebarVisible();

	useEffect(() => {
		function sync() {
			setTitle(derivePageTitle());
			setHome(isHome());
		}
		const observer = new MutationObserver(sync);
		const titleEl = document.querySelector('title');
		if (titleEl) {
			observer.observe(titleEl, { childList: true });
		}
		window.addEventListener('popstate', sync);
		return () => {
			observer.disconnect();
			window.removeEventListener('popstate', sync);
		};
	}, []);

	function onBack() {
		if (typeof window === 'undefined') return;
		// Direct-entry pages have no prior entry; fall back to home so the button is never inert.
		if (window.history?.length > 1) window.history.back();
		else window.location.assign('/');
	}

	if (sidebarVisible) {
		return (
			<div className="flex sm:hidden items-center px-4 h-16 bg-cinemata-pacific-deep-900">
				<TopbarUploadButton className="flex w-full" />
			</div>
		);
	}

	return (
		<div className="flex sm:hidden items-center justify-between gap-3 px-4 h-16 bg-cinemata-pacific-deep-900">
			{home ? (
				<span aria-hidden="true" className="w-8 h-8 shrink-0" />
			) : (
				<button
					type="button"
					onClick={onBack}
					aria-label="Go back"
					className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cinemata-pacific-deep-800 hover:bg-cinemata-pacific-deep-700 transition-colors shrink-0 text-cinemata-strait-blue-100"
				>
					<Icon name="chevronLeft" size={18} decorative />
				</button>
			)}
			<Text as="h1" variant="body-16-bold" className="m-0 flex-1 truncate text-cinemata-strait-blue-50">
				{title}
			</Text>
			<TopbarUploadButton compact />
		</div>
	);
}
