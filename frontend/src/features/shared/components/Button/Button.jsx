import { Children, isValidElement } from 'react';
import { cn } from '../../utils/classNames';
export const VARIANT_CLASSES = {
	primary: 'border border-transparent bg-brand-primary text-btn-text hover:bg-brand-primary-hover',
	secondary: 'border border-transparent bg-bg-primary text-text-on-primary hover:bg-bg-primary-hover',
	tertiary:
		'border border-brand-secondary-border bg-brand-secondary text-btn-secondary-text hover:bg-brand-secondary-hover',
	special: 'border border-transparent bg-bg-overlay-dark text-text-on-chrome hover:bg-bg-chrome-hover',
	'primary-outline':
		'border border-brand-primary bg-transparent text-brand-primary hover:bg-brand-primary hover:text-btn-text',
	'secondary-outline':
		'border border-border-strong bg-transparent text-text-strong hover:bg-bg-surface-inverse hover:text-text-inverse',
	text: 'border-none bg-transparent text-text-secondary hover:text-text-link-hover',
	icon: 'border-none bg-transparent text-text-secondary hover:text-text-link-hover',
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

export const SIZE_CLASSES = {
	base: 'px-space-base py-size-10',
	sm: 'px-size-12 py-size-8 rounded-ds-8',
	xs: 'px-size-12 py-size-4 rounded-ds-4',
};

export function getSizeClasses(size) {
	return SIZE_CLASSES[size] ?? SIZE_CLASSES.base;
}

export const ICON_ONLY_SIZE_CLASSES = {
	base: 'p-size-12 rounded-ds-4',
	sm: 'p-size-10 rounded-ds-8',
	xs: 'p-size-8 rounded-ds-4',
};

export function getIconOnlySizeClasses(size) {
	return ICON_ONLY_SIZE_CLASSES[size] ?? ICON_ONLY_SIZE_CLASSES.base;
}

function isIconOnlyVariant(variant) {
	return variant === 'icon';
}

function hasHiddenClassName(className) {
	if (typeof className !== 'string') {
		return false;
	}

	const classTokens = className.split(/\s+/);

	return classTokens.includes('hidden') || classTokens.includes('sr-only');
}

function hasVisibleNodeContent(node) {
	if (node == null || typeof node === 'boolean') {
		return false;
	}

	if (typeof node === 'string') {
		return node.trim().length > 0;
	}

	if (typeof node === 'number') {
		return true;
	}

	if (!isValidElement(node)) {
		return true;
	}

	if (node.props.hidden || hasHiddenClassName(node.props.className)) {
		return false;
	}

	if ('children' in node.props) {
		return hasVisibleLabelContent(node.props.children);
	}

	return true;
}

function hasVisibleLabelContent(children) {
	return Children.toArray(children).some(hasVisibleNodeContent);
}

export function Button({
	align = 'center',
	children,
	className = '',
	icon = null,
	textClassName = '',
	iconContainerClassName = '',
	iconPosition,
	size = 'base',
	type = 'button',
	variant = 'primary',
	...props
}) {
	const hasLabel = hasVisibleLabelContent(children);
	const resolvedIconPosition = iconPosition ?? (variant === 'special' ? 'right' : 'left');
	const iconElement = icon ? (
		<span
			aria-hidden="true"
			className={cn(
				'inline-flex shrink-0 items-center justify-center leading-none [&_img]:h-full [&_img]:w-full [&_svg]:h-full [&_svg]:w-full',
				iconContainerClassName
			)}
			style={{ width: 'var(--size-20)', height: 'var(--size-20)' }}
		>
			{icon}
		</span>
	) : null;
	const isCompactIconLayout = isIconOnlyVariant(variant);
	const shouldCenterIcon = !hasLabel;
	const layoutClasses = isCompactIconLayout
		? 'gap-0 p-0'
		: cn(
				hasLabel ? getSizeClasses(size) : getIconOnlySizeClasses(size),
				hasLabel ? 'gap-space-xs rounded-ds-4' : 'gap-0'
			);

	return (
		<button
			type={type}
			className={cn(
				'inline-flex cursor-pointer items-center uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 body-body-14-bold',
				getAlignClasses(shouldCenterIcon ? 'center' : align),
				getVariantClasses(variant),
				layoutClasses,
				className
			)}
			{...props}
		>
			{iconElement && resolvedIconPosition !== 'right' ? iconElement : null}
			{isCompactIconLayout || !hasLabel ? null : (
				<span className={cn('inline-flex items-center justify-center leading-none', textClassName)}>
					{children}
				</span>
			)}
			{iconElement && resolvedIconPosition === 'right' ? iconElement : null}
		</button>
	);
}
