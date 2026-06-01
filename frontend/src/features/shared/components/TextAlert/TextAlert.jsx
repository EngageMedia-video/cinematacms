import { cn } from '../../utils/classNames';
import { Icon } from '../Icon';

export function TextAlert({
	children = 'Alert message',
	className = '',
	iconName = 'infoCircle',
	role = 'alert',
	...props
}) {
	return (
		<div
			{...props}
			role={role}
			className={cn('body-body-16-regular flex w-full items-center gap-3 text-text-accent', className)}
		>
			<span
				aria-hidden="true"
				className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-text-accent"
			>
				<Icon name={iconName} size={24} decorative />
			</span>

			<span className="min-w-0 flex-1">{children}</span>
		</div>
	);
}
