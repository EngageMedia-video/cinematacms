import { Badge } from '../Badge';
import { Icon } from '../Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

function MovieItemContainer({ children, contentClassName = '', shellClassName = '', link = '', title = '' }) {
	if (link) {
		return (
			<article className={shellClassName}>
				<a
					href={link}
					className={joinClasses(
						'h-full w-full cursor-pointer text-inherit no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-600p dark:focus-visible:ring-cinemata-strait-blue-200',
						contentClassName
					)}
					aria-label={title ? `Open ${title}` : 'Open movie details'}
				>
					{children}
				</a>
			</article>
		);
	}

	return <article className={joinClasses(shellClassName, contentClassName)}>{children}</article>;
}

function MovieMetadata({ items = [] }) {
	const validItems = items.filter(Boolean);

	if (!validItems.length) {
		return null;
	}

	return (
		<div className="body-body-12-regular flex flex-wrap items-center text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-400">
			{validItems.map((item, index) => (
				<span key={`${item}-${index}`} className="inline-flex items-center">
					{index > 0 ? (
						<span
							aria-hidden="true"
							className="mx-2 h-[4px] w-[4px] rounded-full bg-cinemata-neutral-500 dark:bg-cinemata-pacific-deep-400"
						/>
					) : null}
					<span>{item}</span>
				</span>
			))}
		</div>
	);
}

function MovieCopy({ title, subtitle, metadata, orientation = 'vertical' }) {
	return (
		<div
			className={joinClasses('flex min-w-0 flex-col', orientation === 'horizontal' ? 'gap-3' : 'gap-2')}
			data-movie-copy
		>
			<p className="body-body-16-medium m-0 p-0 text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50 line-clamp-3">{title}</p>

			{subtitle ? (
				<p className="body-body-14-regular m-0 p-0 text-cinemata-sunset-horizon-600 dark:text-cinemata-sunset-horizon-200">{subtitle}</p>
			) : null}

			<MovieMetadata items={metadata} />
		</div>
	);
}

function MoviePoster({
	imageAlt,
	imageSrc,
	badge,
	badgeColor,
	duration,
	iconName,
	iconLabel,
	className = '',
	showTopRightIcon = false,
}) {
	return (
		<div className={joinClasses('relative overflow-hidden rounded-[6px] bg-cinemata-neutral-200 dark:bg-cinemata-pacific-deep-800', className)}>
			<img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" />

			{badge ? (
				<Badge color={badgeColor} className="absolute bottom-3 left-3" data-movie-item-badge>
					{badge}
				</Badge>
			) : null}

			{duration ? (
				<span
					className="caption-caption-10-regular absolute right-3 bottom-3 inline-flex rounded-[2px] bg-[#111111]/90 p-1 text-cinemata-white dark:text-cinemata-strait-blue-50"
					data-movie-item-duration
				>
					{duration}
				</span>
			) : null}

			{showTopRightIcon && iconName ? (
				<span
					className="absolute top-3 right-3 inline-flex rounded-[2px] bg-cinemata-sunset-horizon-400p px-2 py-1 text-cinemata-white dark:text-cinemata-pacific-deep-900"
					data-movie-item-icon-chip
				>
					<Icon name={iconName} size={16} decorative={iconLabel ? false : true} label={iconLabel} />
				</span>
			) : null}
		</div>
	);
}

export function HorizontalMovieItem({
	badge = '',
	badgeColor = '#026690',
	className = '',
	duration = '',
	imageAlt = 'Movie artwork',
	imageSrc,
	link = '',
	metadata = [],
	subtitle = '',
	title = 'Movie Title',
}) {
	return (
		<MovieItemContainer
			shellClassName={joinClasses('w-full', className)}
			contentClassName="flex h-full w-full items-start gap-4"
			link={link}
			title={title}
		>
			<MoviePoster
				imageAlt={imageAlt}
				imageSrc={imageSrc}
				badge={badge}
				badgeColor={badgeColor}
				duration={duration}
				className="aspect-video w-[180px] shrink-0"
			/>

			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<MovieCopy title={title} subtitle={subtitle} metadata={metadata} orientation="horizontal" />
			</div>
		</MovieItemContainer>
	);
}

export function VerticalMovieItem({
	badge = '',
	badgeColor = '#026690',
	className = '',
	duration = '',
	iconLabel = '',
	iconName = '',
	imageAlt = 'Movie artwork',
	imageSrc,
	link = '',
	metadata = [],
	subtitle = '',
	title = 'Movie Title',
}) {
	return (
		<MovieItemContainer
			shellClassName={joinClasses('w-full min-w-0', className)}
			contentClassName="flex h-full w-full min-w-0 flex-col gap-4"
			link={link}
			title={title}
		>
			<MoviePoster
				imageAlt={imageAlt}
				imageSrc={imageSrc}
				badge={badge}
				badgeColor={badgeColor}
				duration={duration}
				iconName={iconName}
				iconLabel={iconLabel}
				showTopRightIcon
				className="aspect-video w-full"
			/>

			<MovieCopy title={title} subtitle={subtitle} metadata={metadata} orientation="vertical" />
		</MovieItemContainer>
	);
}

export function MovieItem({ orientation = 'vertical', ...props }) {
	if (orientation === 'horizontal') {
		return <HorizontalMovieItem {...props} />;
	}

	return <VerticalMovieItem {...props} />;
}
