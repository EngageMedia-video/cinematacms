import React, { forwardRef } from 'react';

import { cn } from '../../shared/utils/classNames';

export const TopbarIconButton = forwardRef(function TopbarIconButton(
	{ className, children, type = 'button', ...rest },
	ref
) {
	return (
		<button
			ref={ref}
			type={type}
			className={cn(
				'inline-flex items-center justify-center w-10 h-10 rounded-full bg-bg-chrome hover:bg-bg-chrome-hover transition-colors shrink-0 text-text-on-chrome-strong',
				className
			)}
			{...rest}
		>
			{children}
		</button>
	);
});
