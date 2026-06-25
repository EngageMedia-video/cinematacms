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

	beforeEach(() => {
		MockImage.instances = [];
		global.Image = MockImage;
		Element.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		global.Image = OriginalImage;
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
});
