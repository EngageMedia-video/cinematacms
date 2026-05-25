import { cn } from '../../utils/classNames';
import { resolveColor } from '../../utils/resolveColor';

export function Badge({
	children = 'Featured',
	className = '',
	color = 'var(--cinemata-pacific-deep-950)',
	style,
	...props
}) {
	return (
		<span
			{...props}
			className={cn(
				'caption-caption-10-regular inline-flex items-center rounded-[2px] p-1 text-cinemata-neutral-50',
				className
			)}
			style={{
				backgroundColor: resolveColor(color),
				...style,
			}}
		>
			{children}
		</span>
	);
}
