import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/classNames';
import { SpriteFrame } from './SpriteFrame';
import { useSpriteFrames } from '../hooks/useSpriteFrames';

function nearestFrameIndex(frames, currentSeconds, spriteSecs) {
	if (!frames.length) {
		return 0;
	}

	const index = Math.round((Number(currentSeconds) || 0) / (Number(spriteSecs) || 10));
	return Math.max(0, Math.min(index, frames.length - 1));
}

function placeholderMessage(unavailable) {
	return unavailable ? 'Frame preview is unavailable for this video.' : 'Please hang tight when the video loads...';
}

export function FrameStrip({
	currentThumbnailTime = '',
	duration,
	onFrameSelect,
	onSpriteStatusChange,
	pending = false,
	spriteSecs,
	spritesUrl,
	thumbnailInput,
	unavailable = false,
	uploadedPosterClearInput,
}) {
	const { frames, rowsInSheet, status } = useSpriteFrames({ spritesUrl, duration, spriteSecs });
	const initialSelection = useMemo(
		() => nearestFrameIndex(frames, currentThumbnailTime, spriteSecs),
		[frames, currentThumbnailTime, spriteSecs]
	);
	const [selectedIndex, setSelectedIndex] = useState(initialSelection);
	const selectedFrame = frames[selectedIndex] || frames[0] || null;
	const selectedButtonRef = useRef(null);

	useEffect(() => {
		if (onSpriteStatusChange) {
			onSpriteStatusChange(status);
		}
	}, [onSpriteStatusChange, status]);

	useEffect(() => {
		setSelectedIndex(initialSelection);
	}, [initialSelection]);

	useEffect(() => {
		if (selectedButtonRef.current) {
			selectedButtonRef.current.scrollIntoView({ block: 'nearest', inline: 'center' });
		}
	}, [selectedIndex]);

	function selectFrame(frame) {
		setSelectedIndex(frame.index);
		const selectedFrameData = { ...frame, rowsInSheet };

		if (thumbnailInput) {
			thumbnailInput.value = String(frame.seconds);
			thumbnailInput.dispatchEvent(new Event('input', { bubbles: true }));
			thumbnailInput.dispatchEvent(new Event('change', { bubbles: true }));
		}

		if (uploadedPosterClearInput) {
			uploadedPosterClearInput.checked = true;
			uploadedPosterClearInput.dispatchEvent(new Event('change', { bubbles: true }));
		}

		if (onFrameSelect) {
			onFrameSelect(selectedFrameData);
		}
	}

	const showPlaceholder = unavailable || pending || status !== 'ready' || frames.length === 0;
	const message = placeholderMessage(unavailable);

	return (
		<div className="flex min-w-0 max-w-full flex-col gap-space-base overflow-hidden">
			<div
				className={cn(
					'w-full min-w-0 max-w-full rounded-ds-4 border-2 border-border-scrollbar bg-bg-surface-muted',
					showPlaceholder
						? 'h-[56px]'
						: 'flex h-[56px] items-start overflow-x-auto overflow-y-hidden p-size-4 [scrollbar-width:thin] [scrollbar-color:var(--border-scrollbar)_transparent] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-ds-full [&::-webkit-scrollbar-thumb]:bg-border-scrollbar'
				)}
			>
				{showPlaceholder
					? null
					: frames.map((frame) => {
							const selected = frame.index === selectedFrame?.index;

							return (
								<button
									key={frame.index}
									ref={selected ? selectedButtonRef : null}
									aria-pressed={selected}
									className={cn(
										'h-[44px] w-[78.421px] shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 shadow-none outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface-muted',
										selected && 'rounded-ds-4 ring-2 ring-ring-focus'
									)}
									onClick={() => selectFrame(frame)}
									type="button"
								>
									<SpriteFrame
										index={frame.index}
										label={`Select video frame at ${frame.mmss}`}
										selected={selected}
										spritesUrl={spritesUrl}
									/>
								</button>
							);
						})}
			</div>
			<p
				className={cn(
					'body-body-16-regular m-0 min-h-[24px]',
					showPlaceholder ? 'text-text-accent' : 'w-full text-center text-text-muted md:w-[553px]'
				)}
			>
				{showPlaceholder ? message : selectedFrame?.mmss}
			</p>
		</div>
	);
}
