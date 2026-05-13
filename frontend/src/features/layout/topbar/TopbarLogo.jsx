import React, { useContext } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import { Icon } from '../../shared/components/Icon';

export function TopbarLogo() {
	const links = useContext(LinksContext);

	return (
		<a
			href={links?.home || '/'}
			aria-label="Cinemata home"
			style={{ color: '#FFFFFF' }}
			className="inline-flex items-center gap-2 shrink-0 no-underline"
		>
			<Icon name="cinemataMark" size={36} decorative style={{ color: '#FFFFFF' }} />
			<span className="hidden sm:inline-flex items-center" style={{ color: '#FFFFFF' }}>
				<Icon name="cinemataWordmark" style={{ width: 110, height: 26, color: '#FFFFFF' }} decorative />
			</span>
		</a>
	);
}
