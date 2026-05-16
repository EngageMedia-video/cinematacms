import React, { useContext } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import { Icon } from '../../shared/components/Icon';

export function TopbarLogo() {
	const links = useContext(LinksContext);

	return (
		<a
			href={links?.home || '/'}
			aria-label="Cinemata home"
			className="inline-flex items-center gap-2 shrink-0 no-underline text-cinemata-white"
		>
			<Icon name="cinemataMark" size={36} decorative />
			<span className="hidden sm:inline-flex items-center">
				<Icon name="cinemataWordmark" style={{ width: 110, height: 26 }} decorative />
			</span>
		</a>
	);
}
