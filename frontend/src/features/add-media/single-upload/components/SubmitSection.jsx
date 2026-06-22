import { ConfirmationDialogContent, Dialog, TextAlert } from '../../../shared/components';
import { Button } from '../../../shared/components/Button';
import { Text } from '../../../shared/components/Text';

export function SubmitSection({
	onSaveDraft,
	onReviewConfirm,
	onShareClick,
	onSubmitAfterDownloadConfirm,
	singleUpload,
	submitMutation,
}) {
	return (
		<>
			<TextAlert>
				Uploading to Cinemata does not transfer ownership. <br />
				You keep full rights and control over how your film is shared.
			</TextAlert>

			{singleUpload.submitError || Object.keys(singleUpload.errors).length > 0 ? (
				<div
					role="alert"
					className="rounded-ds-4 border border-border-danger bg-bg-surface px-4 py-3 text-text-danger"
				>
					<Text variant="body-14-bold" as="p" className="m-0 text-text-danger">
						{singleUpload.submitError || 'Please fill in all required fields before sharing your media.'}
					</Text>
				</div>
			) : null}

			<div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-end">
				<Button type="button" variant="secondary" onClick={onSaveDraft} disabled={submitMutation.isPending}>
					{submitMutation.isPending ? 'Saving…' : 'Save as Draft'}
				</Button>

				<Button type="button" onClick={onShareClick} disabled={submitMutation.isPending}>
					{submitMutation.isPending ? 'Sharing…' : 'Share Media'}
				</Button>
			</div>

			<Dialog
				open={singleUpload.shareStage === 'download'}
				onOpenChange={(open) => !open && singleUpload.setShareStage(null)}
			>
				<ConfirmationDialogContent
					title="Heads-up! This media can be downloaded."
					subtitle="Just to confirm that you consciously checked the Allow Download button."
					aria-label="Allow download confirmation"
					actions={
						<>
							<Button variant="secondary-outline" onClick={() => singleUpload.setShareStage(null)}>
								Cancel
							</Button>
							<Button variant="primary" onClick={onSubmitAfterDownloadConfirm}>
								Yes, Proceed
							</Button>
						</>
					}
				/>
			</Dialog>

			<Dialog
				open={singleUpload.shareStage === 'review'}
				onOpenChange={(open) => !open && singleUpload.setShareStage(null)}
			>
				<ConfirmationDialogContent
					title="Submit For Review?"
					subtitle="As a regular user, your video needs to be reviewed by an admin before being published. You will get an email notification after the review."
					aria-label="Submit for review confirmation"
					actions={
						<>
							<Button variant="secondary-outline" onClick={() => singleUpload.setShareStage(null)}>
								Cancel
							</Button>
							<Button variant="primary" onClick={onReviewConfirm}>
								Yes, Submit
							</Button>
						</>
					}
				/>
			</Dialog>
		</>
	);
}
