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
	return media.description || media.summary || '';
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
		'm-0 w-fit no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-focus';

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

export function HeroMediaCard({ className = '', media }) {
	if (!media) {
		return null;
	}

	const description = getDescription(media);
	const country = getCountry(media);
	const views = formatViews(media.views);
	const authorHref = media.author_profile || '';
	const mediaHref = getMediaHref(media);

	return (
		<div className={cn('w-full min-w-0', className)}>
			<Card className="flex h-full min-h-[360px] flex-col justify-between gap-8 overflow-hidden px-[22px] pb-6 pt-[22px] lg:min-h-0">
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
							className="m-0 max-h-[260px] overflow-hidden lg:max-h-[280px]"
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

export function HeroMediaCardSkeleton({ className = '' }) {
	return (
		<Card as="div" className={cn('w-full min-w-0 p-[22px]', className)}>
			<div className="h-8 w-3/4 animate-pulse rounded bg-bg-skeleton" />
			<div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-bg-skeleton" />
		</Card>
	);
}
