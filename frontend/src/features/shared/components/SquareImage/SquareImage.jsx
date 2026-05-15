import { cn } from '../../utils/classNames';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

export function SquareImage({
	alt = 'Square image',
	className = '',
	iconName = '',
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

	const centeredIconName = loading ? 'loading' : iconName;
	const showCenteredIcon = Boolean(centeredIconName) && (loading || !showImage);

	return (
		<span
			{...props}
			className={cn(
				'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-cinemata-neutral-200 dark:bg-cinemata-pacific-deep-800',
				className
			)}
			style={{
				width: size,
				height: size,
				borderRadius: radius,
				...style,
			}}
			role={showImage ? undefined : 'img'}
			aria-label={showImage ? undefined : alt}
			aria-busy={loading ? 'true' : undefined}
		>
			{showImage ? (
				<img
					src={src}
					alt={alt}
					className="h-full w-full object-cover"
					onError={(event) => {
						setShowImage(false);
						onError?.(event);
					}}
				/>
			) : null}

			{loading ? (
				<span
					aria-hidden="true"
					className="absolute inset-0 bg-cinemata-neutral-200 dark:bg-cinemata-pacific-deep-800 opacity-80"
				/>
			) : null}

			{showCenteredIcon ? (
				<span aria-hidden="true" className="absolute inset-0 inline-flex items-center justify-center">
					<Icon
						name={centeredIconName}
						decorative
						size={21}
						className={cn(
							'text-cinemata-neutral-600 dark:text-cinemata-neutral-50',
							loading ? 'animate-spin' : ''
						)}
					/>
				</span>
			) : null}
		</span>
	);
}
