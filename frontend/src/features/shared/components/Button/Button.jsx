import { cn } from '../../utils/classNames';
export const VARIANT_CLASSES = {
	primary: 'border border-transparent bg-brand-primary text-btn-text hover:bg-brand-primary-hover',
	secondary:
		'border border-brand-secondary-border bg-brand-secondary text-btn-secondary-text hover:bg-brand-secondary-hover',
	tertiary: 'border-0 bg-bg-primary text-text-on-primary hover:bg-bg-primary-hover',
	special:
		'border border-transparent bg-cinemata-pacific-deep-600p text-cinemata-white hover:bg-cinemata-pacific-deep-700 dark:bg-cinemata-pacific-deep-950 dark:text-cinemata-white dark:hover:bg-cinemata-pacific-deep-900',
	'primary-outline':
		'border border-brand-primary bg-transparent text-brand-primary hover:bg-brand-primary hover:text-btn-text',
	'secondary-outline':
		'border border-cinemata-strait-blue-900 bg-transparent text-cinemata-strait-blue-900 hover:bg-cinemata-strait-blue-900 hover:text-cinemata-strait-blue-100 dark:border-cinemata-strait-blue-900 dark:text-cinemata-strait-blue-100 dark:hover:bg-cinemata-strait-blue-900 dark:hover:text-cinemata-strait-blue-100',
	text: 'border-none bg-transparent text-cinemata-strait-blue-600p hover:text-cinemata-strait-blue-800 dark:text-cinemata-strait-blue-600p dark:hover:text-cinemata-strait-blue-800',
	icon: 'border-none bg-transparent text-cinemata-strait-blue-600p hover:text-cinemata-strait-blue-800 dark:text-cinemata-strait-blue-600p dark:hover:text-cinemata-strait-blue-800',
};

export function getVariantClasses(variant) {
	return VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
}

export const ALIGN_CLASSES = {
	left: 'justify-start',
	center: 'justify-center',
	right: 'justify-end',
	between: 'justify-between',
};

export function getAlignClasses(align) {
	return ALIGN_CLASSES[align] ?? ALIGN_CLASSES.center;
}
function isIconOnlyVariant(variant) {
	return variant === 'icon';
}

export function Button({
	align = 'center',
	children,
	className = '',
	icon = null,
	iconPosition,
	type = 'button',
	variant = 'primary',
	...props
}) {
	const resolvedIconPosition = iconPosition ?? (variant === 'special' ? 'right' : 'left');
	const iconElement = icon ? (
		<span
			aria-hidden="true"
			className="inline-flex shrink-0 items-center justify-center leading-none [&_img]:h-full [&_img]:w-full [&_svg]:h-full [&_svg]:w-full"
			style={{ width: 'var(--size-20)', height: 'var(--size-20)' }}
		>
			{icon}
		</span>
	) : null;

	return (
		<button
			type={type}
			className={cn(
				'body-body-14-bold inline-flex cursor-pointer items-center transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
				getAlignClasses(align),
				isIconOnlyVariant(variant) ? 'gap-0 p-0' : 'gap-space-xs rounded-ds-4 px-space-base py-size-10',
				getVariantClasses(variant),
				className
			)}
			{...props}
		>
			{iconElement && resolvedIconPosition !== 'right' ? iconElement : null}
			{isIconOnlyVariant(variant) ? null : (
				<span className="inline-flex items-center justify-center leading-none">{children}</span>
			)}
			{iconElement && resolvedIconPosition === 'right' ? iconElement : null}
		</button>
	);
}
