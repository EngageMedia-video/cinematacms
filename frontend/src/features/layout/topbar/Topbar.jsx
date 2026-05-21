import React, { useContext, useEffect } from 'react';

import '../../../static/css/tailwind.css';

import UserContext from '../../../static/js/contexts/UserContext';
import { Icon } from '../../shared/components/Icon';
import { TopbarIconButton } from './TopbarIconButton';
import { TopbarLogo } from './TopbarLogo';
import { TopbarMobileBar } from './TopbarMobileBar';
import { TopbarNotificationButton } from './TopbarNotificationButton';
import { TopbarSearchDesktop } from './TopbarSearchDesktop';
import { TopbarSearchMobileOverlay } from './TopbarSearchMobileOverlay';
import { TopbarSidebarToggle } from './TopbarSidebarToggle';
import { TopbarUploadButton } from './TopbarUploadButton';
import { TopbarUserMenu } from './TopbarUserMenu';
import useTopbarStore from './useTopbarStore';
import { useIsHomeRoute } from './useIsHomeRoute';
import { useSidebarVisible } from './useSidebarVisible';

export function Topbar() {
	const openMobileSearch = useTopbarStore((state) => state.openMobileSearch);
	const user = useContext(UserContext);
	const isHome = useIsHomeRoute();
	const sidebarVisible = useSidebarVisible();
	// Anonymous users get a full-width search bar in row 2 whenever row 2 has
	// no UPLOAD action to show (home, or sidebar drawer open). In those cases
	// the top-row search icon would be redundant.
	const showMobileSearchIcon = !(user?.is?.anonymous && (isHome || sidebarVisible));

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
				className="fixed inset-x-0 z-[60] w-full border-b-2 border-white/10 bg-cinemata-pacific-deep-900 text-cinemata-white"
			>
				<div className="flex items-center gap-3 px-4 h-[60px] sm:h-[90px]">
					<TopbarSidebarToggle />
					<TopbarLogo />
					<TopbarSearchDesktop />
					{showMobileSearchIcon ? (
						<TopbarIconButton
							onClick={openMobileSearch}
							aria-label="Open search"
							className="sm:hidden ml-auto"
						>
							<Icon name="magnifyingGlass" size={20} decorative />
						</TopbarIconButton>
					) : (
						<span aria-hidden="true" className="sm:hidden ml-auto" />
					)}
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
