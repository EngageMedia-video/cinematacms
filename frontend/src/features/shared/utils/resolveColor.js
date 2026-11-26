const SEMANTIC_FAMILIES = ['bg', 'text', 'border', 'ring'];
const DEFAULT_VARIANT = /-default$/;

function startsWithFamily(name) {
	return SEMANTIC_FAMILIES.some((family) => name === family || name.startsWith(`${family}-`));
}

// Accepts the Figma path (`bg/surface/raised`), the Tailwind utility
// (`bg-bg-surface-raised`) and the variable name (`bg-surface-raised`), and
// names the variable the way scripts/generate_color_tokens.py does.
function semanticVariableName(color) {
	const name = color.replaceAll('/', '-').replace(DEFAULT_VARIANT, '');
	if (!startsWithFamily(name)) {
		return null;
	}

	const withoutUtilityPrefix = name.slice(name.indexOf('-') + 1);
	return startsWithFamily(withoutUtilityPrefix) && !color.includes('/') ? withoutUtilityPrefix : name;
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

	const semanticName = semanticVariableName(color);
	if (semanticName) {
		return `var(--${semanticName})`;
	}

	if (color.startsWith('cinemata-')) {
		return `var(--${color})`;
	}

	return `var(--cinemata-${color})`;
}
