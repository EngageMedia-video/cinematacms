import { Button } from '../../shared/components';

export function SubmitActions({ isSubmitting, uploadBusy }) {
	return (
		<div className="flex flex-col-reverse gap-3 border-t border-border-divider pt-6 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="secondary-outline"
				onClick={() => window.history.back()}
				disabled={isSubmitting}
			>
				Cancel
			</Button>
			<Button type="submit" disabled={uploadBusy || isSubmitting}>
				{uploadBusy ? 'Upload in progress...' : isSubmitting ? 'Updating...' : 'Update Media'}
			</Button>
		</div>
	);
}
