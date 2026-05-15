import { cn } from '../../utils/classNames';

const VARIANT_CLASSES = {
	default: 'rounded-xl bg-bg-cards dark:bg-cinemata-pacific-deep-900',
	muted: 'rounded-xl bg-cinemata-neutral-200 dark:bg-cinemata-pacific-deep-800',
	outlined:
		'rounded-xl border border-cinemata-pacific-deep-100 bg-cinemata-neutral-50 dark:border-cinemata-pacific-deep-700 dark:bg-cinemata-pacific-deep-900',
};

export function Card({ as: Component = 'article', children, className = '', variant = 'default', ...props }) {
	const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;
	return (
		<Component {...props} className={cn(variantClass, className)}>
			{children}
		</Component>
	);
}
