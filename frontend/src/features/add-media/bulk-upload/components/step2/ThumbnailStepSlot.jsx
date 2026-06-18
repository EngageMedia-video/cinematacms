import { Icon } from '../../../../shared/components';

/**
 * Empty slot for the Thumbnail Image Upload sub-step, owned by issue #541. The
 * picker is intentionally not built here — this placeholder reserves the slot.
 */
export function ThumbnailStepSlot() {
	return (
		<div
			data-thumbnail-slot
			className="flex flex-col items-center gap-3 rounded-ds-8 border border-dashed border-border-default bg-bg-surface-muted px-6 py-10 text-center"
		>
			<Icon name="featured" size={32} decorative className="text-text-muted" />
			<p className="body-body-14-regular m-0 text-text-muted">
				Thumbnail selection is coming soon. You will be able to upload a custom image or choose a still frame
				from your video.
			</p>
		</div>
	);
}
