import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThumbnailImageUpload } from './ThumbnailImageUpload';

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

describe('ThumbnailImageUpload', () => {
	const OriginalImage = global.Image;

	beforeEach(() => {
		MockImage.instances = [];
		global.Image = MockImage;
		Element.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		global.Image = OriginalImage;
	});

	it('renders the choose-from-video frame strip and reports selected seconds', async () => {
		const user = userEvent.setup();
		const onFrameSelect = vi.fn();

		render(
			<ThumbnailImageUpload
				duration={80}
				friendlyToken="abc123"
				onFileChanged={vi.fn()}
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
			expect.objectContaining({ index: 2, rowsInSheet: 5, seconds: 20, spritesUrl: '/sprites.jpg' })
		);
		expect(screen.getByText('0:20')).toBeInTheDocument();
	});

	it('shows the loading wording when sprite data is unavailable', async () => {
		const user = userEvent.setup();

		render(<ThumbnailImageUpload friendlyToken="" onFileChanged={vi.fn()} onFrameSelect={vi.fn()} />);

		await user.click(screen.getByRole('tab', { name: 'CHOOSE FROM VIDEO' }));

		expect(screen.getByText(/Please hang tight when the video loads/i)).toBeInTheDocument();
	});
});
