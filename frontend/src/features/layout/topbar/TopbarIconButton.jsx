import React, { forwardRef } from 'react';

import { cn } from '../../shared/utils/classNames';

export const TopbarIconButton = forwardRef(function TopbarIconButton(
	{ className, children, type = 'button', ...rest },
	ref,
) {
	return (
		<button
			ref={ref}
			type={type}
			className={cn(
				'inline-flex items-center justify-center w-10 h-10 rounded-full bg-cinemata-pacific-deep-800 hover:bg-cinemata-pacific-deep-700 transition-colors shrink-0 text-cinemata-white',
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	);
});
