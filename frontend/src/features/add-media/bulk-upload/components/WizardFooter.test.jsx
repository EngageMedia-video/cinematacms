import { render, screen } from '@testing-library/react';
import { WizardFooter } from './WizardFooter';

describe('WizardFooter', () => {
	it('shows the Share Media action on the final step', () => {
		render(<WizardFooter primaryAction="share" />);
		expect(screen.getByRole('button', { name: /share media/i })).toHaveClass('bg-brand-primary');
		expect(screen.getByRole('button', { name: /save as draft/i })).toBeInTheDocument();
	});

	it('shows the Next action with the provided label otherwise', () => {
		render(<WizardFooter primaryAction="next" primaryLabel="Next: Add Details" />);
		expect(screen.getByRole('button', { name: /next: add details/i })).toHaveClass('bg-bg-primary');
	});

	it('disables the primary action when it is not allowed', () => {
		render(<WizardFooter primaryAction="next" primaryLabel="Next" canPrimary={false} />);
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('hides the Back button when showBack is false', () => {
		render(<WizardFooter primaryAction="next" primaryLabel="Next" showBack={false} />);
		expect(screen.queryByRole('button', { name: /^back/i })).not.toBeInTheDocument();
	});

	it('disables Save as Draft when canDraft is false', () => {
		render(<WizardFooter primaryAction="next" primaryLabel="Next" canDraft={false} />);
		expect(screen.getByRole('button', { name: /save as draft/i })).toBeDisabled();
	});

	it('enables Save as Draft by default', () => {
		render(<WizardFooter primaryAction="next" primaryLabel="Next" />);
		expect(screen.getByRole('button', { name: /save as draft/i })).toBeEnabled();
	});
});
