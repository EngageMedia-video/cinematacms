import React from 'react';

// Sidebar reads from LayoutStore + LayoutActions; mirroring the
// toggle action in a Zustand store would force two sources of truth.
import * as LayoutActions from '../../../static/js/actions/LayoutActions.js';
import { Icon } from '../../shared/components/Icon';
import { useSidebarVisible } from './useSidebarVisible';

export function TopbarSidebarToggle() {
	const isVisible = useSidebarVisible();

	function onClick() {
		LayoutActions.toggleSidebar();
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={isVisible ? 'Close menu' : 'Open menu'}
			aria-expanded={isVisible}
			className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent text-cinemata-white hover:bg-cinemata-pacific-deep-800 transition-colors shrink-0 cursor-pointer"
		>
			<Icon name={isVisible ? 'close' : 'menu'} size={22} decorative />
		</button>
	);
}
