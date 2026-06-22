import { Button } from '../../../shared/components';

/**
 * Wizard footer: SAVE AS DRAFT (left), and BACK + NEXT/SHARE MEDIA (right).
 * Labels and the primary action are decided by the page root and passed in.
 */
export function WizardFooter({
	showBack = false,
	backLabel = 'Back',
	primaryLabel = 'Next',
	primaryAction = 'next',
	onBack,
	onNext,
	onShare,
	onSaveDraft,
	canPrimary = true,
	canDraft = true,
	isSubmitting = false,
}) {
	return (
		<div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-divider pt-6">
			<Button variant="tertiary" onClick={onSaveDraft} disabled={!canDraft || isSubmitting}>
				Save as Draft
			</Button>

			<div className="flex flex-wrap items-center gap-3">
				{showBack ? (
					<Button variant="secondary-outline" onClick={onBack} disabled={isSubmitting}>
						{backLabel}
					</Button>
				) : null}

				{primaryAction === 'share' ? (
					<Button variant="primary" onClick={onShare} disabled={!canPrimary || isSubmitting}>
						{isSubmitting ? 'Submitting…' : 'Share Media'}
					</Button>
				) : (
					<Button variant="secondary" onClick={onNext} disabled={!canPrimary || isSubmitting}>
						{primaryLabel}
					</Button>
				)}
			</div>
		</div>
	);
}
