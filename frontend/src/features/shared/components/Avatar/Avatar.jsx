import { cn } from '../../utils/classNames';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

const AVATAR_SIZES = {
	small: {
		dimension: 'var(--size-28)',
		pixelDimension: 28,
		textClassName: 'body-body-12-bold',
	},
	large: {
		dimension: 'var(--size-32)',
		pixelDimension: 32,
		textClassName: 'body-body-14-bold',
	},
};

const BADGE_VARIANTS = {
	comment: {
		className: 'bg-bg-primary',
		iconName: 'commentBlue',
		label: 'Comment',
	},
	'added-favorite': {
		className: 'bg-bg-secondary',
		iconName: 'addedFavorite',
		label: 'Added favorite',
	},
	like: {
		className: 'bg-bg-danger-strong',
		iconName: 'thumbsUpRed',
		label: 'Like',
	},
};

function getNormalizedSize(size) {
	if (size === 'sm') {
		return 'small';
	}

	if (size === 'lg') {
		return 'large';
	}

	if (size && Object.hasOwn(AVATAR_SIZES, size)) {
		return size;
	}

	return 'small';
}

function getInitials(name) {
	const segments = name.trim().split(/\s+/).filter(Boolean);

	if (!segments.length) {
		return '';
	}

	if (segments.length === 1) {
		return segments[0].slice(0, 1).toUpperCase();
	}

	return `${segments[0][0]}${segments[segments.length - 1][0]}`.toUpperCase();
}

function getBadgeVariant(type) {
	if (type && Object.hasOwn(BADGE_VARIANTS, type)) {
		return BADGE_VARIANTS[type];
	}

	return null;
}

export function Avatar({
	alt,
	badgeIcon = '',
	badgeType = '',
	className = '',
	label = '',
	name = '',
	size = 'small',
	src = '',
	onError,
	style,
	...props
}) {
	const normalizedSize = getNormalizedSize(size);
	const sizeConfig = AVATAR_SIZES[normalizedSize];
	const initials = getInitials(name);
	const accessibleName = alt || name || 'Avatar';
	const badgeVariant = getBadgeVariant(badgeType);
	const [showImage, setShowImage] = useState(Boolean(src));
	const resolvedBadgeIconName = badgeIcon || badgeVariant?.iconName || '';
	const resolvedBadgeIcon = resolvedBadgeIconName ? (
		<Icon
			name={resolvedBadgeIconName}
			decorative
			size={normalizedSize === 'small' ? 'xs' : 'sm'}
			data-badge-icon={resolvedBadgeIconName}
		/>
	) : null;
	const resolvedBadgeLabel = label || badgeVariant?.label || '';

	useEffect(() => {
		setShowImage(Boolean(src));
	}, [src]);

	return (
		<span
			{...props}
			className={cn('relative inline-flex shrink-0 align-top overflow-visible rounded-full', className)}
			style={{
				width: sizeConfig.dimension,
				height: sizeConfig.dimension,
				...style,
			}}
			role={showImage ? undefined : 'img'}
			aria-label={showImage ? undefined : accessibleName}
		>
			<span className="inline-flex h-full w-full select-none items-center justify-center overflow-hidden rounded-full bg-bg-surface-muted text-text-muted">
				{showImage ? (
					<img
						src={src}
						alt={accessibleName}
						width={sizeConfig.pixelDimension}
						height={sizeConfig.pixelDimension}
						className="h-full w-full object-cover"
						onError={(event) => {
							setShowImage(false);
							onError?.(event);
						}}
					/>
				) : (
					<span aria-hidden="true" className="inline-flex h-full w-full items-center justify-center">
						<span className={cn('leading-none uppercase', sizeConfig.textClassName)}>{initials}</span>
					</span>
				)}
			</span>

			{resolvedBadgeIcon ? (
				<span
					className={cn(
						'absolute right-[-8px] bottom-[-20px] inline-flex items-center justify-center rounded-full border-[3px] border-border-subtle p-[7px] text-text-on-primary',
						badgeVariant?.className || 'bg-bg-primary'
					)}
					style={{
						width: sizeConfig.dimension,
						height: sizeConfig.dimension,
						boxSizing: 'border-box',
					}}
					role={resolvedBadgeLabel ? 'img' : undefined}
					aria-hidden={resolvedBadgeLabel ? undefined : 'true'}
					aria-label={resolvedBadgeLabel || undefined}
				>
					<span aria-hidden="true" className="inline-flex h-full w-full items-center justify-center">
						{resolvedBadgeIcon}
					</span>
				</span>
			) : null}
		</span>
	);
}
