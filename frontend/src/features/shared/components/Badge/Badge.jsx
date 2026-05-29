import { cn } from '../../utils/classNames';
import { resolveColor } from '../../utils/resolveColor';

export function Badge({
	children = 'Featured',
	className = '',
	color = 'bg/surface-inverse',
	style,
	...props
}) {
	return (
		<span
			{...props}
			className={cn(
				'caption-caption-10-regular inline-flex items-center rounded-[2px] p-1 text-text-on-primary',
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
