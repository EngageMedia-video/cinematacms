import { FrameStrip } from './FrameStrip';
import { useSpritePolling } from '../hooks/useSpritePolling';

export function ChooseFromVideo({
	currentThumbnailTime = '',
	duration = '',
	friendlyToken = '',
	onFrameSelect,
	posterUrl = '',
	spriteSecs = '',
	spritesUrl = '',
}) {
	const spriteData = useSpritePolling({
		friendlyToken,
		initialDuration: duration,
		initialPosterUrl: posterUrl,
		initialSpritesUrl: spritesUrl,
		initialThumbnailTime: currentThumbnailTime,
		initialSpriteNumSecs: spriteSecs,
	});
	const activeSpritesUrl = spriteData.spritesUrl || spritesUrl;
	const activeDuration = spriteData.duration || duration;
	const activeThumbnailTime = spriteData.thumbnailTime ?? currentThumbnailTime;
	// Prefer the server-authoritative interval (must match how files/sprites.py spaced the
	// tiles); fall back to the prop, then 10. Never assume a hardcoded interval here, or the
	// chosen tile's timestamp won't match the frame the backend extracts for the poster.
	const activeSpriteSecs = Number(spriteData.spriteNumSecs) || Number(spriteSecs) || 10;

	function handleFrameSelect(frame) {
		onFrameSelect?.({ ...frame, spritesUrl: activeSpritesUrl });
	}

	return (
		<div className="flex min-w-0 max-w-full flex-col overflow-hidden">
			<FrameStrip
				currentThumbnailTime={activeThumbnailTime}
				duration={activeDuration}
				onFrameSelect={handleFrameSelect}
				pending={spriteData.status === 'polling' || spriteData.status === 'idle'}
				spriteSecs={activeSpriteSecs}
				spritesUrl={activeSpritesUrl}
				unavailable={spriteData.status === 'unavailable'}
			/>
		</div>
	);
}
