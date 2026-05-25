import React, { useContext } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import UserContext from '../../../static/js/contexts/UserContext';
import { Icon } from '../../shared/components/Icon';
import { cn } from '../../shared/utils/classNames';

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
			className={cn(
				'inline-flex items-center justify-center gap-2 rounded h-10 px-4 text-sm font-bold uppercase tracking-wide transition-all shrink-0 no-underline bg-brand-primary text-btn-text hover:bg-brand-primary-hover',
				compact ? 'w-[129px]' : 'min-w-[166px]',
				className
			)}
		>
			<span
				aria-hidden="true"
				className="inline-flex items-center justify-center shrink-0 [&_svg]:h-full [&_svg]:w-full"
				style={{ width: 20, height: 20 }}
			>
				<Icon name="upload" size={20} decorative />
			</span>
			<span className={compact ? 'truncate' : 'whitespace-nowrap'}>
				{compact ? 'UPLOAD MEDIA…' : 'UPLOAD MEDIA'}
			</span>
		</a>
	);
}
