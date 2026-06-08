import { cn } from '../../shared/utils/classNames';
import { Card } from '../../shared/components/Card';
import { Text } from '../../shared/components/Text';

function getCountry(media) {
	if (Array.isArray(media.media_country_info)) {
		return media.media_country_info[0]?.title || media.media_country || '';
	}

	return media.media_country_info?.title || media.media_country || '';
}

function getDescription(media) {
	return media.summary || media.description || '';
}

function formatViews(value) {
	if (value === undefined || value === null || value === '') {
		return '';
	}

	if ('string' === typeof value && value.toLowerCase().includes('view')) {
		return value;
	}

	const count = Number(value);
	const formatted = Number.isFinite(count) ? count.toLocaleString() : value;
	return `${formatted} ${1 === count ? 'view' : 'views'}`;
}

function getMediaHref(media) {
	return media.url || media.link || '';
}

function AuthorName({ href, name }) {
	if (!name) {
		return null;
	}

	const className =
		'm-0 inline-flex min-h-8 w-fit max-w-full touch-manipulation items-center no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-focus';

	if (href) {
		return (
			<Text as="a" variant="body-12" color="sunset-horizon" className={className} href={href}>
				{name}
			</Text>
		);
	}

	return (
		<Text as="span" variant="body-12" color="sunset-horizon" className={className}>
			{name}
		</Text>
	);
}

export function HeroMediaCard({ className = '', media, style, isDesktop = false }) {
	if (!media) {
		return null;
	}

	const description = getDescription(media);
	const country = getCountry(media);
	const views = formatViews(media.views);
	const authorHref = media.author_profile || '';
	const mediaHref = getMediaHref(media);

	return (
		<div className={cn('flex min-w-0 flex-col', className)} style={style}>
			<Card
				className={cn(
					// justify-between pins the author/country/views block to the card bottom
					// when the summary is short (the spare height goes into the gap). When the
					// summary is long there is no spare height, so the groups sit at the gap-4
					// minimum (16px) and the card grows past its floor without clipping. The
					// card fills its minHeight floor via flex-1.
					'flex flex-1 flex-col justify-between gap-4 overflow-hidden px-[22px] pb-6 pt-[22px]',
					isDesktop ? '' : 'min-h-[360px]'
				)}
			>
				<div className="flex min-w-0 flex-col gap-3">
					<Text as="h2" variant="h6" className="m-0 max-w-full overflow-hidden break-words text-text-primary">
						{mediaHref ? (
							<a
								href={mediaHref}
								className="text-inherit no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-focus"
							>
								{media.title}
							</a>
						) : (
							media.title
						)}
					</Text>

					{description ? (
						<Text
							variant="body-14"
							color="description"
							// The card height is a floor, not a cap (see heroCardStyle and
							// the flex-1 card), so the full text always renders and the card
							// grows when needed. The displayed field is `summary`, capped at
							// 60 words server-side (files/forms.py clean_summary);
							// `description` is the rare unbounded fallback used only when
							// summary is empty.
							className="m-0"
						>
							{description}
						</Text>
					) : null}
				</div>

				<div className="flex min-w-0 flex-col gap-2">
					<AuthorName href={authorHref} name={media.author_name} />

					{country || views ? (
						<p className="m-0 flex flex-wrap items-center gap-x-1">
							{country ? (
								<Text as="span" variant="body-12" color="meta">
									{country}
								</Text>
							) : null}
							{country && views ? (
								<Text as="span" variant="body-12" color="meta" aria-hidden="true">
									·
								</Text>
							) : null}
							{views ? (
								<Text as="span" variant="body-12" color="meta">
									{views}
								</Text>
							) : null}
						</p>
					) : null}
				</div>
			</Card>
		</div>
	);
}

export function HeroMediaCardSkeleton({ className = '', style }) {
	return (
		<Card as="div" className={cn('min-w-0 p-[22px]', className)} style={style}>
			<div className="h-8 w-3/4 animate-pulse rounded bg-bg-skeleton" />
			<div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-bg-skeleton" />
		</Card>
	);
}
