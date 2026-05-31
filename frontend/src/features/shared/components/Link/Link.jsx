import { cn } from '../../utils/classNames';
import { getAlignClasses, getVariantClasses } from '../Button/Button';

const TEXT_LINK_CLASSES = 'no-underline decoration-0 transition-colors duration-200';

function isButtonVariant(variant) {
	return variant !== 'text';
}

export function Link({
	align = 'center',
	children,
	className = '',
	href,
	icon = null,
	iconPosition = 'left',
	variant = 'text',
	...props
}) {
	const iconElement = icon ? (
		<span
			aria-hidden="true"
			className="inline-flex shrink-0 items-center justify-center leading-none [&_img]:h-full [&_img]:w-full [&_svg]:h-full [&_svg]:w-full"
			style={{ width: 'var(--size-20)', height: 'var(--size-20)' }}
		>
			{icon}
		</span>
	) : null;

	if (isButtonVariant(variant)) {
		return (
			<a
				href={href}
				className={cn(
					'body-body-14-bold inline-flex cursor-pointer items-center no-underline transition-colors duration-200',
					getAlignClasses(align),
					'gap-space-xs rounded-ds-4 px-space-base py-size-10',
					getVariantClasses(variant),
					className
				)}
				{...props}
			>
				{iconElement && iconPosition !== 'right' ? iconElement : null}
				<span className="inline-flex items-center justify-center leading-none">{children}</span>
				{iconElement && iconPosition === 'right' ? iconElement : null}
			</a>
		);
	}

	return (
		<a href={href} className={cn(TEXT_LINK_CLASSES, className)} {...props}>
			{children}
		</a>
	);
}
