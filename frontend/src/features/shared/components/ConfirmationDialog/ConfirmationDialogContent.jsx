import { cn } from '../../utils/classNames';
import cornerDecoration from './assets/confirmation-corner.webp';
import { DialogContent } from '../Dialog';
import { Icon } from '../Icon';

export function ConfirmationDialogContent({
	title = 'Submit changes?',
	subtitle = 'Please review your changes carefully before continuing.',
	iconName = 'info3d',
	children,
	actions = null,
	decorationSrc = cornerDecoration,
	decorationAlt = '',
	className = '',
	...props
}) {
	return (
		<DialogContent
			{...props}
			className={cn('w-full max-w-[520px] bg-transparent p-0 text-left shadow-none', className)}
		>
			<div className="relative overflow-hidden p-5 sm:p-[26px] border-[0.5px] rounded-2xl border-cinemata-neutral-300 bg-linear-to-br from-cinemata-white to-cinemata-neutral-50 dark:border-cinemata-strait-blue-300 dark:from-cinemata-pacific-deep-900 dark:to-cinemata-pacific-deep-950">
				{decorationSrc ? (
					<img
						src={decorationSrc}
						alt={decorationAlt}
						aria-hidden={decorationAlt ? undefined : 'true'}
						className="pointer-events-none absolute right-0 bottom-0 w-[160px] max-w-[52%] object-contain"
					/>
				) : null}

				<div className="relative z-10 flex flex-col">
					<div className="flex flex-col items-start text-left">
						<Icon name={iconName} size={68} decorative className="shrink-0" />
						<h2 className="heading-h5-24-medium p-0 m-0 mt-4 text-text-strong">{title}</h2>
						<p className="body-body-16-regular p-0 m-0 mt-2 text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-300">
							{subtitle}
						</p>
					</div>

					{children ? <div className="relative z-10 mt-8">{children}</div> : null}
					{actions ? (
						<div className="relative z-10 mt-8 flex flex-wrap justify-end gap-3 sm:gap-4">{actions}</div>
					) : null}
				</div>
			</div>
		</DialogContent>
	);
}
