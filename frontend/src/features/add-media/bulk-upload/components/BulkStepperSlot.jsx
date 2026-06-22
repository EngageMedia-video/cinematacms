import { WizardStepper } from './WizardStepper';

/**
 * Renders the bulk wizard stepper in the AddMediaPage left rail (outside the
 * bulk tab content). WizardStepper reads the shared store itself, so this is a
 * thin wrapper that keeps the import boundary tidy.
 */
export function BulkStepperSlot() {
	return <WizardStepper />;
}
