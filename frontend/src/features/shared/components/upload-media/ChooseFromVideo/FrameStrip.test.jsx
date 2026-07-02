import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FrameStrip } from './FrameStrip';

class MockImage {
	static instances = [];

	constructor() {
		this.naturalHeight = 450;
		MockImage.instances.push(this);
	}

	set src(value) {
		this._src = value;
	}

	get src() {
		return this._src;
	}
}

describe('FrameStrip', () => {
	const OriginalImage = global.Image;

	const originalScrollIntoView = Element.prototype.scrollIntoView;

	beforeEach(() => {
		MockImage.instances = [];
		global.Image = MockImage;
		Element.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		global.Image = OriginalImage;
		Element.prototype.scrollIntoView = originalScrollIntoView;
	});

	it('writes the selected frame seconds into the hidden thumbnail input', async () => {
		const user = userEvent.setup();
		const thumbnailInput = document.createElement('input');
		const clearInput = document.createElement('input');
		thumbnailInput.id = 'id_thumbnail_time';
		clearInput.type = 'checkbox';

		render(
			<FrameStrip
				currentThumbnailTime="0"
				duration={80}
				spriteSecs={10}
				spritesUrl="/sprites.jpg"
				thumbnailInput={thumbnailInput}
				uploadedPosterClearInput={clearInput}
			/>
		);

		act(() => {
			MockImage.instances[0].onload();
		});

		await waitFor(() => expect(screen.getByRole('button', { name: /0:20/i })).toBeInTheDocument());
		await user.click(screen.getByRole('button', { name: /0:20/i }));

		expect(thumbnailInput.value).toBe('20');
		expect(clearInput.checked).toBe(true);
		expect(screen.getByText('0:20')).toBeInTheDocument();
	});

	it('shows an unavailable message when the sprite image fails to load', async () => {
		render(<FrameStrip duration={80} spriteSecs={10} spritesUrl="/missing-sprites.jpg" />);

		act(() => {
			MockImage.instances[0].onerror();
		});

		await waitFor(() => {
			expect(screen.getByText(/Frame preview is unavailable for this video/i)).toBeInTheDocument();
		});
	});

	it('renders every frame — including the last — at the same size on a fixed grid', async () => {
		// 450px natural height / 90 = 5 rows; duration 50 / 10 = 5 frames (indices 0..4).
		// Unique URL so useSpriteFrames' per-URL rows cache doesn't short-circuit image load.
		render(
			<FrameStrip currentThumbnailTime="0" duration={50} spriteSecs={10} spritesUrl="/sprites-lastframe.jpg" />
		);

		act(() => {
			MockImage.instances[0].onload();
		});

		await waitFor(() => expect(screen.getByRole('img', { name: /0:40/i })).toBeInTheDocument());

		// The last frame (0:40) must not shrink relative to the first (0:00): same height, and a
		// backgroundSize whose height is pinned to rows*scaledFrameHeight (not `auto`).
		const first = screen.getByRole('img', { name: /video frame at 0:00/i });
		const last = screen.getByRole('img', { name: /video frame at 0:40/i });

		expect(last.style.height).toBe(first.style.height);
		expect(last.style.backgroundSize).toBe(first.style.backgroundSize);
		// Height is pinned to rows*scaledFrameHeight, not `auto` (the source of the last-frame drift).
		expect(last.style.backgroundSize).not.toContain('auto');
		const scaledFrameHeight = (90 * 78.421) / 160;
		expect(last.style.backgroundSize).toBe(`78.421px ${5 * scaledFrameHeight}px`);
	});
});
