import { VerticalMovieItem } from '../shared/components/MovieItem';
import { SpriteFrame } from '../shared/components/UploadMedia/ChooseFromVideo/SpriteFrame';
import { cn } from '../shared/utils/classNames';

// Fully transparent 1x1 GIF. While no thumbnail has been selected or
// auto-generated yet, this lets the poster's `bg-bg-skeleton` show through as a
// neutral placeholder instead of a broken-image icon.
const PLACEHOLDER_THUMBNAIL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const DEFAULT_BADGE_COLOR = 'bg/primary';

function formatViews(views) {
	if (views == null || views === '') {
		return null;
	}

	const numeric = Number(views);

	if (Number.isNaN(numeric)) {
		return null;
	}

	return `${numeric.toLocaleString()} views`;
}

/**
 * Live preview panel for the upload/edit form. Renders the media exactly as it
 * will appear as a thumbnail card in listings, reusing the shared
 * `VerticalMovieItem` media card so the preview never drifts from production.
 *
 * Purely presentational: it derives its display from the props the host form
 * passes on every edit, so the card updates in real time as the user types.
 */
export function QuickPreview({
	title = '',
	thumbnailUrl = '',
	thumbnailFrame = null,
	durationLabel = '',
	category = null,
	subtitle = '',
	country = '',
	views = null,
	className = '',
}) {
	const metadata = [country, formatViews(views)].filter(Boolean);
	const thumbnailOverlay = thumbnailFrame?.spritesUrl ? (
		<SpriteFrame
			className="h-full w-full"
			index={thumbnailFrame.index}
			label={title ? `${title} selected video frame` : 'Selected video frame thumbnail preview'}
			rowsInSheet={thumbnailFrame.rowsInSheet}
			selected
			spritesUrl={thumbnailFrame.spritesUrl}
			variant="fill"
		/>
	) : null;

	return (
		<section
			aria-label="Quick preview"
			className={cn('flex w-full flex-col gap-4 rounded-2xl bg-bg-surface px-[22px] py-8', className)}
		>
			<h2 className="h5-24-medium m-0 text-text-strong">Quick Preview</h2>
			<hr className="m-0 w-full border-0 border-t border-border-default" />
			<VerticalMovieItem
				title={title || 'Untitled media'}
				imageSrc={thumbnailUrl || PLACEHOLDER_THUMBNAIL}
				imageAlt={title ? `${title} thumbnail` : 'Thumbnail preview'}
				thumbnailOverlay={thumbnailOverlay}
				duration={durationLabel}
				badge={category?.title || ''}
				badgeColor={category?.color || DEFAULT_BADGE_COLOR}
				subtitle={subtitle}
				metadata={metadata}
			/>
		</section>
	);
}
