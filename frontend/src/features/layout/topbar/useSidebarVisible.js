import { useEffect, useState } from 'react';

// Sidebar reads from LayoutStore; mirroring this in a
// Zustand store would force two sources of truth for the same flag.
/* eslint-disable no-restricted-imports */
import LayoutStore from '../../../static/js/stores/LayoutStore.js';
/* eslint-enable no-restricted-imports */

export function useSidebarVisible() {
	const [visible, setVisible] = useState(() => Boolean(LayoutStore.get('visible-sidebar')));

	useEffect(() => {
		function onChange() {
			setVisible(Boolean(LayoutStore.get('visible-sidebar')));
		}
		LayoutStore.on('sidebar-visibility-change', onChange);
		return () => {
			LayoutStore.removeListener?.('sidebar-visibility-change', onChange);
		};
	}, []);

	return visible;
}
