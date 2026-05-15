import { cn } from '../../utils/classNames';
function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function resolveProgressPercent(value, max) {
	if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
		return 0;
	}

	return clamp((value / max) * 100, 0, 100);
}

export function ProgressBar({
	value = 20,
	max = 100,
	label = 'Progress',
	className = '',
	trackClassName = '',
	indicatorClassName = '',
}) {
	const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
	const safeValue = Number.isFinite(value) ? clamp(value, 0, safeMax) : 0;
	const progressPercent = resolveProgressPercent(safeValue, safeMax);
	const indicatorRadiusClass =
		progressPercent >= 100
			? 'rounded-full'
			: progressPercent > 0
				? 'rounded-l-full rounded-r-none'
				: 'rounded-none';

	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={safeMax}
			aria-valuenow={safeValue}
			className={cn('w-full', className)}
		>
			<div
				className={cn(
					'h-2 w-full overflow-hidden rounded-full bg-cinemata-coral-reef-100 dark:bg-cinemata-coral-reef-900',
					trackClassName
				)}
			>
				<div
					aria-hidden="true"
					className={cn(
						'h-full bg-cinemata-coral-reef-400p transition-[width] duration-200',
						indicatorRadiusClass,
						indicatorClassName
					)}
					style={{ width: `${progressPercent}%` }}
				/>
			</div>
		</div>
	);
}
