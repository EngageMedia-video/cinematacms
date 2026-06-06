import { cn } from '../../utils/classNames';
import { resolveColor } from '../../utils/resolveColor';
import { Icon } from '../Icon';

export function Badge({
	children = 'Featured',
	className = '',
	color = 'bg/surface-inverse',
	dismissLabel,
	onDismiss,
	style,
	...props
}) {
	const isDismissible = typeof onDismiss === 'function';

	return (
		<span
			{...props}
			className={cn(
				'caption-caption-10-regular inline-flex items-center rounded-[2px] p-1 text-text-on-primary',
				isDismissible && 'gap-[10px]',
				className
			)}
			style={{
				backgroundColor: resolveColor(color),
				...style,
			}}
		>
			{children}
			{isDismissible ? (
				<button
					type="button"
					className="inline-flex h-4 w-4 cursor-pointer appearance-none items-center justify-center border-0 bg-transparent p-0 text-current shadow-none transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-bg-chip-active"
					style={{ appearance: 'none', background: 'transparent', border: 0, boxShadow: 'none' }}
					aria-label={dismissLabel || `Remove ${typeof children === 'string' ? children : ''}`}
					onClick={onDismiss}
				>
					<Icon name="close" size={16} decorative />
				</button>
			) : null}
		</span>
	);
}
