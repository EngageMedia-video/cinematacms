import { cn } from '../../../utils/classNames';
import { SPRITE_FRAME_WIDTH, SPRITE_SOURCE_HEIGHT, SPRITE_SOURCE_WIDTH } from '../hooks/useSpriteFrames';

export function SpriteFrame({
	className = '',
	index,
	label,
	rowsInSheet = 0,
	selected = false,
	spritesUrl,
	variant = 'strip',
}) {
	const width = variant === 'preview' ? 150 : SPRITE_FRAME_WIDTH;

	if (variant === 'fill') {
		const safeRows = Math.max(1, Number(rowsInSheet) || Number(index) + 1 || 1);

		return (
			<span
				aria-label={label}
				className={cn('relative block h-full w-full overflow-hidden', className)}
				role={label ? 'img' : undefined}
			>
				<span
					aria-hidden="true"
					className="absolute top-0 left-0 block w-full bg-no-repeat"
					style={{
						height: `${safeRows * 100}%`,
						backgroundImage: `url("${spritesUrl}")`,
						backgroundPosition: '0 0',
						backgroundSize: '100% 100%',
						transform: `translateY(-${(Number(index) / safeRows) * 100}%)`,
					}}
				/>
			</span>
		);
	}

	// The sprite sheet is a vertical column of SPRITE_SOURCE_WIDTH x SPRITE_SOURCE_HEIGHT
	// frames. We render each frame at `width`, so the whole sheet is scaled by this ratio;
	// the per-frame height and the vertical offset must use the SAME scaled height, or the
	// slice drifts a fraction of a pixel per row and every frame ends up showing nearly the
	// same content. Derive both from the source aspect ratio instead of a rounded constant.
	const scale = width / SPRITE_SOURCE_WIDTH;
	const scaledFrameHeight = SPRITE_SOURCE_HEIGHT * scale;
	// Pin the background height to `rows * scaledFrameHeight` instead of `auto`. `auto` scales
	// the sheet by its REAL natural height, but the offset math above assumes every row is
	// exactly SPRITE_SOURCE_HEIGHT tall. If the last extracted tile came back a few pixels off
	// (a frame grabbed near EOF can), the sheet height is not a clean rows*90 and only the LAST
	// frame drifts — it renders resized. Forcing an explicit height puts every row (last one
	// included) on the same fixed grid, independent of the JPEG's trailing-row height.
	const safeRows = Math.max(1, Number(rowsInSheet) || Number(index) + 1);

	return (
		<span
			aria-label={label}
			className={cn(
				'block shrink-0 bg-no-repeat',
				variant === 'preview' ? 'rounded-ds-4' : 'rounded-ds-2',
				selected ? 'opacity-100' : 'opacity-30',
				className
			)}
			role={label ? 'img' : undefined}
			style={{
				width,
				height: scaledFrameHeight,
				backgroundImage: `url("${spritesUrl}")`,
				backgroundPosition: `0 -${index * scaledFrameHeight}px`,
				backgroundSize: `${width}px ${safeRows * scaledFrameHeight}px`,
			}}
		/>
	);
}
