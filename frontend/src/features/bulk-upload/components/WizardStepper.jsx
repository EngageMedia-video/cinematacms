import { cn } from '../../shared/utils/classNames';
import { Icon } from '../../shared/components';

const STEPS = [
	{ step: 1, label: 'Bulk Upload Media' },
	{ step: 2, label: 'Enter Details' },
	{ step: 3, label: 'Preview & Submit' },
];

/**
 * Three-step wizard rail. Vertical on large screens (left rail), horizontal on
 * smaller screens. The Enter-Details sub-steps keep the rail on step 2.
 */
export function WizardStepper({ currentStep = 1 }) {
	return (
		<nav aria-label="Upload steps" className="w-full">
			<ol className="flex flex-row gap-4 lg:flex-col lg:gap-6">
				{STEPS.map(({ step, label }) => {
					const isActive = currentStep === step;
					const isDone = currentStep > step;
					return (
						<li
							key={step}
							aria-current={isActive ? 'step' : undefined}
							className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none"
						>
							<span
								className={cn(
									'body-body-14-bold inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
									isActive && 'bg-bg-secondary text-text-inverse',
									isDone && 'bg-bg-success text-text-inverse',
									!isActive && !isDone && 'bg-bg-surface-muted text-text-muted'
								)}
							>
								{isDone ? <Icon name="check" size={16} decorative /> : step}
							</span>
							<span
								className={cn(
									'body-body-14-medium min-w-0 truncate',
									isActive ? 'text-text-strong' : 'text-text-muted'
								)}
							>
								{label}
							</span>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
