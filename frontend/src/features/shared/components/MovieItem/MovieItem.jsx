import { cn } from '../../utils/classNames';
import { Badge } from '../Badge';
import { Icon } from '../Icon';

function MovieItemContainer({
	children,
	contentClassName = '',
	shellClassName = '',
	link = '',
	title = '',
	useWrapperLink = true,
}) {
	if (link && useWrapperLink) {
		return (
			<article className={cn(shellClassName, 'relative')}>
				<a
					href={link}
					className="absolute inset-0 z-10 cursor-pointer rounded-[6px] text-inherit no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					aria-label={title ? `Open ${title}` : 'Open movie details'}
				/>
				<div className={contentClassName}>{children}</div>
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
		<div className="body-body-12-regular flex max-h-[42px] items-start gap-1 overflow-hidden pr-1 whitespace-nowrap text-text-disabled">
			{validItems.map((item, index) => (
				<span key={`${item}-${index}`} className="inline-flex items-center">
					{index > 0 ? (
						<span
							aria-hidden="true"
							className="mr-1 text-[12px] font-bold leading-[18px] text-text-disabled"
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

function MovieCopy({ title, titleLink = '', subtitle, subtitleLink = '', metadata, orientation = 'vertical' }) {
	const titleClassName = cn(
		'm-0 p-0 line-clamp-3',
		'[font-family:Inter,Arial,sans-serif] text-[16px] font-medium leading-[22px] tracking-[-0.18px] text-text-primary'
	);
	const subtitleClassName = 'body-body-12-regular m-0 p-0 text-text-link';

	return (
		<div className="flex min-w-0 flex-col gap-2" data-movie-copy>
			{titleLink ? (
				<a
					href={titleLink}
					className={cn(
						titleClassName,
						'block no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus line-clamp-3'
					)}
				>
					{title}
				</a>
			) : (
				<p className={titleClassName}>{title}</p>
			)}

			{subtitle && subtitleLink ? (
				<a
					href={subtitleLink}
					className={cn(
						subtitleClassName,
						'relative z-20 inline-flex w-fit max-w-full touch-manipulation no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus'
					)}
				>
					{subtitle}
				</a>
			) : subtitle ? (
				<p className={subtitleClassName}>{subtitle}</p>
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
	link = '',
	linkTitle = '',
	showTopRightIcon = false,
}) {
	const poster = (
		<div className={cn('relative overflow-hidden rounded-[6px] bg-bg-skeleton', className)}>
			<img
				src={imageSrc}
				alt={imageAlt}
				width={320}
				height={180}
				className="h-full w-full object-cover"
				loading="lazy"
				decoding="async"
			/>

			{badge ? (
				<Badge color={badgeColor} className="absolute bottom-3 left-3" data-movie-item-badge>
					{badge}
				</Badge>
			) : null}

			{duration ? (
				<span
					className="absolute right-1 bottom-1 inline-flex rounded-[2px] bg-bg-overlay-dark px-1 py-[2px] font-sans text-[12px] font-medium leading-[13.5px] tracking-[0.5px] text-text-on-chrome"
					data-movie-item-duration
				>
					{duration}
				</span>
			) : null}

			{showTopRightIcon && iconName ? (
				<span
					className="absolute top-2 right-2 inline-flex rounded bg-bg-secondary/90 p-1 text-text-on-primary"
					data-movie-item-icon-chip
				>
					<Icon name={iconName} size={14} decorative={iconLabel ? false : true} label={iconLabel} />
				</span>
			) : null}
		</div>
	);

	if (!link) {
		return poster;
	}

	return (
		<a
			href={link}
			className="block shrink-0 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
			aria-label={linkTitle ? `Open ${linkTitle}` : 'Open movie details'}
		>
			{poster}
		</a>
	);
}

export function HorizontalMovieItem({
	badge = '',
	badgeColor = 'bg/primary',
	className = '',
	duration = '',
	imageAlt = 'Movie artwork',
	imageSrc,
	link = '',
	metadata = [],
	subtitle = '',
	subtitleLink = '',
	title = 'Movie Title',
}) {
	const useStandaloneLinks = Boolean(subtitleLink);

	return (
		<MovieItemContainer
			shellClassName={cn('w-full', className)}
			contentClassName="flex h-full w-full items-center gap-4"
			link={link}
			title={title}
			useWrapperLink={!useStandaloneLinks}
		>
			<MoviePoster
				imageAlt={imageAlt}
				imageSrc={imageSrc}
				badge={badge}
				badgeColor={badgeColor}
				duration={duration}
				link={useStandaloneLinks ? link : ''}
				linkTitle={title}
				className="aspect-video w-[180px] shrink-0"
			/>

			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<MovieCopy
					title={title}
					titleLink={useStandaloneLinks ? link : ''}
					subtitle={subtitle}
					subtitleLink={subtitleLink}
					metadata={metadata}
					orientation="horizontal"
				/>
			</div>
		</MovieItemContainer>
	);
}

export function VerticalMovieItem({
	badge = '',
	badgeColor = 'bg/primary',
	className = '',
	duration = '',
	iconLabel = '',
	iconName = '',
	imageAlt = 'Movie artwork',
	imageSrc,
	link = '',
	metadata = [],
	subtitle = '',
	subtitleLink = '',
	title = 'Movie Title',
}) {
	const useStandaloneLinks = Boolean(subtitleLink);

	return (
		<MovieItemContainer
			shellClassName={cn('w-full min-w-0', className)}
			contentClassName="flex h-full w-full min-w-0 flex-col gap-4"
			link={link}
			title={title}
			useWrapperLink={!useStandaloneLinks}
		>
			<MoviePoster
				imageAlt={imageAlt}
				imageSrc={imageSrc}
				badge={badge}
				badgeColor={badgeColor}
				duration={duration}
				iconName={iconName}
				iconLabel={iconLabel}
				link={useStandaloneLinks ? link : ''}
				linkTitle={title}
				showTopRightIcon
				className="aspect-video w-full"
			/>

			<MovieCopy
				title={title}
				titleLink={useStandaloneLinks ? link : ''}
				subtitle={subtitle}
				subtitleLink={subtitleLink}
				metadata={metadata}
				orientation="vertical"
			/>
		</MovieItemContainer>
	);
}

export function MovieItem({
	badge = '',
	badgeColor = 'bg/primary',
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
	subtitleLink = '',
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
				subtitleLink={subtitleLink}
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
			subtitleLink={subtitleLink}
			title={title}
		/>
	);
}
