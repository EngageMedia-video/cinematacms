import React from 'react';

import { GlobalSearchDropdown } from '../../global-search';

export function TopbarSearchDesktop() {
	return (
		<div className="hidden sm:flex flex-1 max-w-[640px] mx-auto">
			<GlobalSearchDropdown />
		</div>
	);
}
