import { Icon } from '../Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

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
			className={joinClasses(
				'body-body-16-regular flex w-full items-center gap-3 text-cinemata-sunset-horizon-600 dark:text-cinemata-sunset-horizon-400p',
				className
			)}
		>
			<span
				aria-hidden="true"
				className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-cinemata-sunset-horizon-600 dark:text-cinemata-sunset-horizon-400p"
			>
				<Icon name={iconName} size={24} decorative />
			</span>

			<span className="min-w-0 flex-1">{children}</span>
		</div>
	);
}
