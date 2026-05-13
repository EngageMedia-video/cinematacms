import React from 'react';

import { GlobalSearchMobileOverlay } from '../../global-search';
import useTopbarStore from './useTopbarStore';

export function TopbarSearchMobileOverlay() {
	const isOpen = useTopbarStore((state) => state.isMobileSearchOpen);
	const close = useTopbarStore((state) => state.closeMobileSearch);

	return <GlobalSearchMobileOverlay isOpen={isOpen} onClose={close} />;
}
