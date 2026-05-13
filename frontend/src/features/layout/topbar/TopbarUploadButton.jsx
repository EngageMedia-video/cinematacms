import React, { useContext } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import UserContext from '../../../static/js/contexts/UserContext';
import { Icon } from '../../shared/components/Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

export function TopbarUploadButton({ className = '', compact = false }) {
	const user = useContext(UserContext);
	const links = useContext(LinksContext);

	if (!user || user.is?.anonymous || !user.can?.addMedia) {
		return null;
	}

	const href = links?.user?.addMedia || '/upload';

	return (
		<a
			href={href}
			aria-label="Upload media"
			style={{ backgroundColor: '#C2692F', color: '#F9FAFB' }}
			className={joinClasses(
				'inline-flex items-center justify-center gap-2 rounded h-10 px-4 hover:brightness-110 text-sm font-bold uppercase tracking-wide transition-all shrink-0 no-underline',
				compact ? 'w-[129px]' : 'w-[166px]',
				className
			)}
		>
			<span
				aria-hidden="true"
				className="inline-flex items-center justify-center shrink-0 [&_svg]:h-full [&_svg]:w-full"
				style={{ width: 20, height: 20, color: '#F9FAFB' }}
			>
				<Icon name="upload" size={20} decorative />
			</span>
			<span className="truncate" style={{ color: '#F9FAFB' }}>
				{compact ? 'UPLOAD MEDIA…' : 'UPLOAD MEDIA'}
			</span>
		</a>
	);
}
