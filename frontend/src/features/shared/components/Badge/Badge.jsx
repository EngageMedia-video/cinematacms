function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

function resolveBadgeColor(color) {
	if (!color) {
		return color;
	}

	if (color.startsWith('var(') || color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
		return color;
	}

	if (color.startsWith('--')) {
		return `var(${color})`;
	}

	if (color.startsWith('cinemata-')) {
		return `var(--${color})`;
	}

	return `var(--cinemata-${color})`;
}

export function Badge({ children = 'Featured', className = '', color = '#111111', style, ...props }) {
	return (
		<span
			{...props}
			className={joinClasses(
				'caption-caption-10-regular inline-flex items-center rounded-[2px] p-1 text-cinemata-neutral-50',
				className
			)}
			style={{
				backgroundColor: resolveBadgeColor(color),
				...style,
			}}
		>
			{children}
		</span>
	);
}
