import { cn } from '../../../shared/utils/classNames';
import { Icon } from '../../../shared/components';
import useBulkUploadStore, { UPLOAD_STATUS } from '../useBulkUploadStore';

const STEPS = [
	{ step: 1, label: 'Bulk Upload Media' },
	{ step: 2, label: 'Enter Details' },
	{ step: 3, label: 'Preview & Submit' },
];

/**
 * Three-step wizard rail. Vertical on large screens (left rail), horizontal on
 * smaller screens. Steps are clickable for non-linear navigation (issue #767 /
 * QA feedback): step 1 is always reachable; steps 2–3 unlock once every file has
 * finished uploading. Reads the bulk store directly so it works both embedded in
 * the add-media tab and on the standalone page.
 */
export function WizardStepper() {
	const currentStep = useBulkUploadStore((state) => state.currentStep);
	const files = useBulkUploadStore((state) => state.files);
	const setStep = useBulkUploadStore((state) => state.setStep);
	const setSubStep = useBulkUploadStore((state) => state.setSubStep);

	const canAdvance = files.length > 0 && files.every((file) => file.uploadStatus === UPLOAD_STATUS.COMPLETE);

	function goToStep(step) {
		if (step === currentStep) {
			return;
		}
		if (step !== 1 && !canAdvance) {
			return;
		}
		setStep(step);
		if (step === 2) {
			setSubStep('basic');
		}
	}

	return (
		<nav aria-label="Upload steps" className="w-full">
			<ol className="flex flex-row gap-4 @4xl/page:flex-col @4xl/page:gap-6">
				{STEPS.map(({ step, label }) => {
					const isActive = currentStep === step;
					const isDone = currentStep > step;
					const enabled = step === 1 || canAdvance;
					return (
						<li
							key={step}
							aria-current={isActive ? 'step' : undefined}
							className="flex min-w-0 flex-1 @4xl/page:flex-none"
						>
							<button
								type="button"
								disabled={!enabled}
								onClick={() => goToStep(step)}
								className={cn(
									'flex min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-ds-4',
									enabled ? 'cursor-pointer' : 'cursor-not-allowed'
								)}
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
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
