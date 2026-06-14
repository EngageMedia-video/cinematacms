import { cn } from '../../utils/classNames';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

export function SquareImage({
	alt = 'Square image',
	className = '',
	iconName = '',
	imageProps = {},
	loading = false,
	onError,
	radius = 8,
	size = 60,
	src = '',
	style,
	...props
}) {
	const [showImage, setShowImage] = useState(Boolean(src));

	useEffect(() => {
		setShowImage(Boolean(src));
	}, [src]);

	const {
		alt: imageAlt,
		className: imageClassName = '',
		onError: imageOnError,
		src: imageSrc,
		...restImageProps
	} = imageProps;
	const centeredIconName = loading ? 'loading' : iconName;
	const showCenteredIcon = Boolean(centeredIconName) && (loading || !showImage);
	const shouldRenderImage = showImage || Object.keys(imageProps).length > 0;

	return (
		<span
			{...props}
			className={cn(
				'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-bg-surface-muted',
				className
			)}
			style={{
				width: size,
				height: size,
				borderRadius: radius,
				...style,
			}}
			role={shouldRenderImage ? undefined : 'img'}
			aria-label={shouldRenderImage ? undefined : alt}
			aria-busy={loading ? 'true' : undefined}
		>
			{shouldRenderImage ? (
				<img
					{...restImageProps}
					src={src || imageSrc || undefined}
					alt={imageAlt ?? alt}
					width={size}
					height={size}
					className={cn('h-full w-full object-cover', imageClassName)}
					onError={(event) => {
						setShowImage(false);
						imageOnError?.(event);
						onError?.(event);
					}}
				/>
			) : null}

			{loading ? <span aria-hidden="true" className="absolute inset-0 bg-bg-surface-muted opacity-80" /> : null}

			{showCenteredIcon ? (
				<span aria-hidden="true" className="absolute inset-0 inline-flex items-center justify-center">
					<Icon
						name={centeredIconName}
						decorative
						size={21}
						className={cn('text-text-panel-heading', loading ? 'animate-spin' : '')}
					/>
				</span>
			) : null}
		</span>
	);
}
