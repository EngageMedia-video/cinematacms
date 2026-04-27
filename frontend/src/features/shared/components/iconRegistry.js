const iconModules = import.meta.glob('../icons/*.svg', {
	query: '?react',
	import: 'default',
	eager: true,
});

function toIconName(path) {
	const fileName = path.split('/').pop()?.replace(/\.svg$/, '') || '';

	return fileName.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function buildRegistry() {
	const registry = {};

	for (const [path, component] of Object.entries(iconModules)) {
		const iconName = toIconName(path);

		if (!iconName) {
			continue;
		}

		if (registry[iconName]) {
			throw new Error(
				`Duplicate shared icon name "${iconName}" detected while loading ${path}. Rename one of the SVG files in src/features/shared/icons/.`
			);
		}

		registry[iconName] = component;
	}

	return Object.freeze(registry);
}

export const iconRegistry = buildRegistry();
export const iconNames = Object.freeze(Object.keys(iconRegistry).sort());

export function getIconComponent(name) {
	return iconRegistry[name] || null;
}
