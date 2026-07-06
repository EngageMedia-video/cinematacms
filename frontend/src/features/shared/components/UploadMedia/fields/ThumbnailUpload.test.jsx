import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThumbnailUploadField } from './ThumbnailUpload';

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

describe('ThumbnailUploadField', () => {
	const OriginalImage = global.Image;

	beforeEach(() => {
		MockImage.instances = [];
		global.Image = MockImage;
		Element.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		global.Image = OriginalImage;
	});

	it('renders the choose-from-video strip and reports selected frame seconds', async () => {
		const user = userEvent.setup();
		const onFrameSelect = vi.fn();

		render(
			<ThumbnailUploadField
				duration={80}
				friendlyToken="abc123"
				onFrameSelect={onFrameSelect}
				spritesUrl="/sprites.jpg"
			/>
		);

		await user.click(screen.getByRole('tab', { name: 'CHOOSE FROM VIDEO' }));
		act(() => {
			MockImage.instances[0].onload();
		});

		await waitFor(() => expect(screen.getByRole('button', { name: /0:20/i })).toBeInTheDocument());
		await user.click(screen.getByRole('button', { name: /0:20/i }));

		expect(onFrameSelect).toHaveBeenCalledWith(
			20,
			expect.objectContaining({ index: 2, seconds: 20, spritesUrl: '/sprites.jpg' })
		);
	});

	it('keeps the upload tab usable without a media token', () => {
		const poster = new File(['poster'], 'poster.png', { type: 'image/png' });
		const onFileSelected = vi.fn();

		render(<ThumbnailUploadField onFileSelected={onFileSelected} />);

		fireEvent.change(screen.getByLabelText('Choose thumbnail image'), { target: { files: [poster] } });

		expect(onFileSelected).toHaveBeenCalledWith(poster);
		expect(screen.queryByRole('button', { name: /0:20/i })).not.toBeInTheDocument();
	});
});
