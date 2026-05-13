import { cn } from '../../utils/classNames';
const VARIANT_MAP = {
	// Headings — [typographyClass, defaultElement]
	h1: ['heading-h1-56-medium', 'h1'],
	'h1-regular': ['heading-h1-56-regular', 'h1'],
	'h1-bold': ['heading-h1-56-bold', 'h1'],
	h2: ['heading-h2-48-medium', 'h2'],
	'h2-regular': ['heading-h2-48-regular', 'h2'],
	'h2-bold': ['heading-h2-48-bold', 'h2'],
	h3: ['heading-h3-40-medium', 'h3'],
	'h3-regular': ['heading-h3-40-regular', 'h3'],
	'h3-bold': ['heading-h3-40-bold', 'h3'],
	h4: ['heading-h4-32-medium', 'h4'],
	'h4-regular': ['heading-h4-32-regular', 'h4'],
	'h4-bold': ['heading-h4-32-bold', 'h4'],
	h5: ['heading-h5-24-medium', 'h5'],
	'h5-regular': ['heading-h5-24-regular', 'h5'],
	'h5-bold': ['heading-h5-24-bold', 'h5'],
	h6: ['heading-h6-20-medium', 'h6'],
	'h6-regular': ['heading-h6-20-regular', 'h6'],
	'h6-bold': ['heading-h6-20-bold', 'h6'],
	// Body — default element is <p>
	'body-16': ['body-body-16-regular', 'p'],
	'body-16-medium': ['body-body-16-medium', 'p'],
	'body-14': ['body-body-14-regular', 'p'],
	'body-14-bold': ['body-body-14-bold', 'p'],
	'body-12': ['body-body-12-regular', 'p'],
	'body-12-medium': ['body-body-12-medium', 'p'],
	'body-12-bold': ['body-body-12-bold', 'p'],
	'caption-10': ['caption-caption-10-regular', 'p'],
};

// Semantic color presets — one class applied at a time, no cascade conflict.
// Heading variants default to null (no color); body/caption default to 'body'.
const COLOR_CLASSES = {
	body: 'text-cinemata-pacific-deep-700 dark:text-cinemata-pacific-deep-50',
	meta: 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300',
	'sunset-horizon': 'text-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-200',
};

const HEADING_VARIANTS = new Set([
	'h1',
	'h1-regular',
	'h1-bold',
	'h2',
	'h2-regular',
	'h2-bold',
	'h3',
	'h3-regular',
	'h3-bold',
	'h4',
	'h4-regular',
	'h4-bold',
	'h5',
	'h5-regular',
	'h5-bold',
	'h6',
	'h6-regular',
	'h6-bold',
]);

export function Text({ as, variant = 'body-14', color, className = '', ...props }) {
	const [typographyClass, defaultElement] = VARIANT_MAP[variant] ?? VARIANT_MAP['body-14'];
	const Component = as ?? defaultElement;

	const defaultColor = HEADING_VARIANTS.has(variant) ? null : 'body';
	const colorClass = COLOR_CLASSES[color ?? defaultColor] ?? '';

	return <Component {...props} className={cn(typographyClass, colorClass, className)} />;
}
