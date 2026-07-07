import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaDropzone } from './MediaDropzone';

describe('MediaDropzone', () => {
	it('renders the upload icon, label, and choose-media button with the requested shell classes', () => {
		const { container } = render(<MediaDropzone />);

		const dropzone = container.querySelector('[data-dropzone]');
		const border = container.querySelector('[data-dropzone-border]');
		const button = screen.getByRole('button', { name: 'CHOOSE MEDIA' });
		const icon = container.querySelector('[data-dropzone-icon]');

		expect(dropzone).toHaveAttribute('data-dropzone', 'true');
		expect(border).toHaveAttribute('data-dropzone-border', 'true');
		expect(screen.getByText('Drag & Drop Files(s) or')).toBeVisible();
		expect(button).toBeVisible();
		expect(button).toHaveClass('bg-brand-primary');
		expect(icon).not.toBeNull();
	});

	it('clicks the hidden file input when the button is pressed', async () => {
		const user = userEvent.setup();
		const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

		render(<MediaDropzone />);

		await user.click(screen.getByRole('button', { name: 'CHOOSE MEDIA' }));

		expect(clickSpy).toHaveBeenCalledTimes(1);
		clickSpy.mockRestore();
	});

	it('emits dropped files and resets the dragging state', () => {
		const handleFilesSelected = vi.fn();
		const { container } = render(<MediaDropzone onFilesSelected={handleFilesSelected} />);
		const dropzone = container.querySelector('[data-dropzone]');
		const file = new File(['video'], 'trailer.mp4', { type: 'video/mp4' });

		fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
		expect(dropzone).toHaveAttribute('data-dragging', 'true');

		fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

		expect(handleFilesSelected).toHaveBeenCalledWith([file]);
		expect(dropzone).toHaveAttribute('data-dragging', 'false');
	});

	it('emits selected files from the hidden input change event', () => {
		const handleFilesSelected = vi.fn();
		const { container } = render(<MediaDropzone onFilesSelected={handleFilesSelected} />);
		const input = container.querySelector('input[type="file"]');
		const file = new File(['image'], 'poster.png', { type: 'image/png' });

		fireEvent.change(input, { target: { files: [file] } });

		expect(handleFilesSelected).toHaveBeenCalledWith([file]);
	});

	it('clears the pending drop-animation timer on unmount so it cannot fire afterwards', () => {
		vi.useFakeTimers();
		try {
			const { container, unmount } = render(<MediaDropzone onFilesSelected={vi.fn()} />);
			const dropzone = container.querySelector('[data-dropzone]');
			const file = new File(['video'], 'trailer.mp4', { type: 'video/mp4' });

			fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

			const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
			unmount();
			expect(clearSpy).toHaveBeenCalled();

			// Advancing past the 220ms delay must not run any leftover callback
			// (which would try to setState on an unmounted component).
			expect(() => vi.advanceTimersByTime(300)).not.toThrow();
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});
