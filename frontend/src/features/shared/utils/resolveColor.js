const SEMANTIC_COLOR_TOKENS = {
	bg: new Set([
		'page',
		'surface',
		'surface-raised',
		'surface-muted',
		'surface-inverse',
		'overlay-dark',
		'chrome',
		'chrome-hover',
		'skeleton',
		'control',
		'primary',
		'primary-hover',
		'secondary',
		'secondary-hover',
		'danger',
		'success',
		'warning',
	]),
	text: new Set([
		'strong',
		'primary',
		'secondary',
		'muted',
		'description',
		'subtle',
		'disabled',
		'inverse',
		'on-primary',
		'on-chrome',
		'on-chrome-muted',
		'link',
		'link-hover',
		'accent',
		'danger',
		'success',
		'warning',
	]),
	border: new Set(['default', 'subtle', 'strong', 'strong-constant', 'chrome', 'input', 'danger']),
	ring: new Set(['focus']),
};

function resolveSemanticColor(color) {
	for (const [family, tokens] of Object.entries(SEMANTIC_COLOR_TOKENS)) {
		const slashPrefix = `${family}/`;
		const utilityPrefix = `${family}-${family}-`;
		const shorthandPrefix = `${family}-`;
		let token;

		if (color.startsWith(slashPrefix)) {
			token = color.slice(slashPrefix.length);
		} else if (color.startsWith(utilityPrefix)) {
			token = color.slice(utilityPrefix.length);
		} else if (color.startsWith(shorthandPrefix)) {
			token = color.slice(shorthandPrefix.length);
		}

		if (token && tokens.has(token)) {
			return `var(--${family}-${token})`;
		}
	}

	return null;
}

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

	const semanticColor = resolveSemanticColor(color);
	if (semanticColor) {
		return semanticColor;
	}

	if (color.startsWith('cinemata-')) {
		return `var(--${color})`;
	}

	return `var(--cinemata-${color})`;
}
