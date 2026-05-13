import React, { useEffect, useState } from 'react';

// PageSidebar (legacy) reads from LayoutStore + LayoutActions; mirroring this in a
// Zustand store would force two sources of truth for the same flag.
/* eslint-disable no-restricted-imports */
import LayoutStore from '../../../static/js/stores/LayoutStore.js';
import * as LayoutActions from '../../../static/js/actions/LayoutActions.js';
/* eslint-enable no-restricted-imports */
import { Icon } from '../../shared/components/Icon';

export function TopbarSidebarToggle() {
	const [isVisible, setIsVisible] = useState(() => Boolean(LayoutStore.get('visible-sidebar')));

	useEffect(() => {
		function onChange() {
			setIsVisible(Boolean(LayoutStore.get('visible-sidebar')));
		}
		LayoutStore.on('sidebar-visibility-change', onChange);
		return () => {
			LayoutStore.removeListener?.('sidebar-visibility-change', onChange);
		};
	}, []);

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
