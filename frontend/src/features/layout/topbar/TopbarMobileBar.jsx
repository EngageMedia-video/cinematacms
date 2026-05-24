import React, { useContext, useEffect, useState } from 'react';

import UserContext from '../../../static/js/contexts/UserContext';
import { Icon } from '../../shared/components/Icon';
import { Text } from '../../shared/components/Text';
import { TopbarUploadButton } from './TopbarUploadButton';
import { useIsHomeRoute } from './useIsHomeRoute';
import { useSidebarVisible } from './useSidebarVisible';
import useTopbarStore from './useTopbarStore';

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
	// document.title may start with a separator (e.g. "| Sign In" on django-allauth
	// pages), so filter empty segments before picking the first label.
	const raw = (typeof document !== 'undefined' && document.title) || '';
	const segments = raw
		.split(/[-|–—]/)
		.map((segment) => segment.trim())
		.filter(Boolean);
	return segments[0] || 'Home';
}

export function TopbarMobileBar() {
	const [title, setTitle] = useState(derivePageTitle);
	const sidebarVisible = useSidebarVisible();
	const home = useIsHomeRoute();
	const user = useContext(UserContext);
	const openMobileSearch = useTopbarStore((state) => state.openMobileSearch);

	useEffect(() => {
		function sync() {
			setTitle(derivePageTitle());
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

	const isAnonymous = Boolean(user?.is?.anonymous);

	// Sidebar drawer open OR home → row 2 collapses to a single full-width
	// primary action. Anonymous users see a search-bar affordance (search is
	// their only useful action surface, so the row never goes blank); logged-in
	// users see the UPLOAD MEDIA action they care about.
	if (sidebarVisible || home) {
		if (isAnonymous) {
			return (
				<div className="flex sm:hidden items-center px-4 h-16 bg-bg-overlay-dark">
					<button
						type="button"
						onClick={openMobileSearch}
						aria-label="Open search"
						className="flex w-full items-center gap-2 h-10 px-3 rounded-full bg-bg-chrome hover:bg-bg-chrome-hover transition-colors text-left text-text-on-chrome"
					>
						<Icon name="magnifyingGlass" size={18} decorative />
						<Text as="span" variant="body-14" className="m-0 truncate text-text-on-chrome">
							Search for Films, Members, Events, etc
						</Text>
					</button>
				</div>
			);
		}
		return (
			<div className="flex sm:hidden items-center px-4 h-16 bg-bg-overlay-dark">
				<TopbarUploadButton className="flex w-full" />
			</div>
		);
	}

	// Non-home → back + page title + (UPLOAD if user can upload).
	return (
		<div className="flex sm:hidden items-center justify-between gap-3 px-4 h-16 bg-bg-overlay-dark">
			<button
				type="button"
				onClick={onBack}
				aria-label="Go back"
				className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-chrome hover:bg-bg-chrome-hover transition-colors shrink-0 text-text-on-chrome"
			>
				<Icon name="chevronLeft" size={18} decorative />
			</button>
			<Text as="h1" variant="body-16-bold" className="m-0 flex-1 truncate text-text-on-chrome">
				{title}
			</Text>
			<TopbarUploadButton compact />
		</div>
	);
}
