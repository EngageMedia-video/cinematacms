import { cn } from '../../utils/classNames';

const VARIANT_CLASSES = {
	default: 'rounded-xl bg-bg-surface',
	muted: 'rounded-xl bg-bg-surface-muted',
	outlined: 'rounded-xl border border-border-default bg-bg-surface',
};

export function Card({ as: Component = 'article', children, className = '', variant = 'default', ...props }) {
	const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;
	return (
		<Component {...props} className={cn(variantClass, className)}>
			{children}
		</Component>
	);
}
