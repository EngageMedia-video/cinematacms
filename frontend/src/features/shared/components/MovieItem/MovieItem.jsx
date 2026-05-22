import { cn } from '../../utils/classNames';
import { Badge } from '../Badge';
import { Icon } from '../Icon';

function MovieItemContainer({ children, contentClassName = '', shellClassName = '', link = '', title = '' }) {
	if (link) {
		return (
			<article className={shellClassName}>
				<a
					href={link}
					className={cn(
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

	return <article className={cn(shellClassName, contentClassName)}>{children}</article>;
}

function MovieMetadata({ items = [] }) {
	const validItems = items.filter(Boolean);

	if (!validItems.length) {
		return null;
	}

	return (
		<div className="body-body-12-regular flex max-h-[42px] items-start gap-1 overflow-hidden pr-1 whitespace-nowrap text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-400">
			{validItems.map((item, index) => (
				<span key={`${item}-${index}`} className="inline-flex items-center">
					{index > 0 ? (
						<span
							aria-hidden="true"
							className="mr-1 text-[12px] font-bold leading-[18px] text-cinemata-pacific-deep-400"
						>
							·
						</span>
					) : null}
					<span>{item}</span>
				</span>
			))}
		</div>
	);
}

function MovieCopy({ title, subtitle, metadata, orientation = 'vertical' }) {
	const isHorizontal = orientation === 'horizontal';

	return (
		<div className={cn('flex min-w-0 flex-col', isHorizontal ? 'gap-3' : 'gap-2')} data-movie-copy>
			<p
				className={cn(
					'm-0 p-0 line-clamp-3',
					'[font-family:Inter,Arial,sans-serif] text-[16px] font-medium leading-[22px] tracking-[-0.18px] text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50'
				)}
			>
				{title}
			</p>

			{subtitle ? (
				<p className="body-body-12-regular m-0 p-0 text-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-200">
					{subtitle}
				</p>
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
		<div
			className={cn(
				'relative overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-100 dark:bg-cinemata-pacific-deep-800',
				className
			)}
		>
			<img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" />

			{badge ? (
				<Badge color={badgeColor} className="absolute bottom-3 left-3" data-movie-item-badge>
					{badge}
				</Badge>
			) : null}

			{duration ? (
				<span
					className="absolute right-1 bottom-1 inline-flex rounded-[2px] bg-cinemata-neutral-900 px-1 py-[2px] font-sans text-[12px] font-medium leading-[13.5px] tracking-[0.5px] text-cinemata-white"
					data-movie-item-duration
				>
					{duration}
				</span>
			) : null}

			{showTopRightIcon && iconName ? (
				<span
					className="absolute top-2 right-2 inline-flex rounded bg-cinemata-sunset-horizon-400p/90 p-1 text-cinemata-white"
					data-movie-item-icon-chip
				>
					<Icon name={iconName} size={14} decorative={iconLabel ? false : true} label={iconLabel} />
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
			shellClassName={cn('w-full', className)}
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
			shellClassName={cn('w-full min-w-0', className)}
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

export function MovieItem({
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
	orientation = 'vertical',
	subtitle = '',
	title = 'Movie Title',
}) {
	if (orientation === 'horizontal') {
		return (
			<HorizontalMovieItem
				badge={badge}
				badgeColor={badgeColor}
				className={className}
				duration={duration}
				imageAlt={imageAlt}
				imageSrc={imageSrc}
				link={link}
				metadata={metadata}
				subtitle={subtitle}
				title={title}
			/>
		);
	}

	return (
		<VerticalMovieItem
			badge={badge}
			badgeColor={badgeColor}
			className={className}
			duration={duration}
			iconLabel={iconLabel}
			iconName={iconName}
			imageAlt={imageAlt}
			imageSrc={imageSrc}
			link={link}
			metadata={metadata}
			subtitle={subtitle}
			title={title}
		/>
	);
}
