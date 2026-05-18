import React, { useEffect } from 'react';

import '../../../static/css/tailwind.css';

import { Icon } from '../../shared/components/Icon';
import { TopbarLogo } from './TopbarLogo';
import { TopbarMobileBar } from './TopbarMobileBar';
import { TopbarNotificationButton } from './TopbarNotificationButton';
import { TopbarSearchDesktop } from './TopbarSearchDesktop';
import { TopbarSearchMobileOverlay } from './TopbarSearchMobileOverlay';
import { TopbarSidebarToggle } from './TopbarSidebarToggle';
import { TopbarUploadButton } from './TopbarUploadButton';
import { TopbarUserMenu } from './TopbarUserMenu';
import useTopbarStore from './useTopbarStore';

export function Topbar() {
	const openMobileSearch = useTopbarStore((state) => state.openMobileSearch);

	// Marker for the mobile --header-height override in tailwind.css so it
	// only applies on pages that actually mount this topbar.
	useEffect(() => {
		document.body.setAttribute('data-modern-topbar', '');
		return () => {
			document.body.removeAttribute('data-modern-topbar');
		};
	}, []);

	return (
		<>
			<header
				data-modern-track
				data-topbar
				className="fixed top-0 left-0 right-0 z-[60] w-full border-b-2 border-white/10 bg-cinemata-pacific-deep-900 text-cinemata-white"
			>
				<div className="flex items-center gap-3 px-4 h-[60px] sm:h-[90px]">
					<TopbarSidebarToggle />
					<TopbarLogo />
					<TopbarSearchDesktop />
					<button
						type="button"
						onClick={openMobileSearch}
						aria-label="Open search"
						className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-full bg-cinemata-pacific-deep-800 text-cinemata-white hover:bg-cinemata-pacific-deep-700 transition-colors shrink-0 ml-auto"
					>
						<Icon name="magnifyingGlass" size={20} decorative />
					</button>
					<div className="hidden sm:inline-flex shrink-0">
						<TopbarUploadButton />
					</div>
					<TopbarNotificationButton />
					<TopbarUserMenu />
				</div>
				<TopbarMobileBar />
			</header>
			<TopbarSearchMobileOverlay />
		</>
	);
}
