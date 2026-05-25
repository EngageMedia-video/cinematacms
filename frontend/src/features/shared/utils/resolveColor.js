export function resolveColor(color) {
	if (!color) {
		return color;
	}

	if (color === 'transparent' || color === 'currentColor' || color === 'inherit') {
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
