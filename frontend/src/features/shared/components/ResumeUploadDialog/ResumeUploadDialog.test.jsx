import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResumeUploadDialog } from './ResumeUploadDialog';

const RIVER = { id: 0, name: 'river.mp4', storedBytes: 8 * 1024 * 1024, totalBytes: 10 * 1024 * 1024 };
const FOREST = { id: 1, name: 'forest.mp4', storedBytes: 1024, totalBytes: 4096 };

describe('ResumeUploadDialog', () => {
	it('stays closed when no upload waits', () => {
		render(<ResumeUploadDialog uploads={[]} onConfirm={() => {}} />);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('names the file and the part that is saved', () => {
		render(<ResumeUploadDialog uploads={[RIVER]} onConfirm={() => {}} />);

		expect(screen.getByRole('dialog', { name: 'Part of this file is already uploaded' })).toBeVisible();
		expect(
			screen.getByText(
				'“river.mp4” was partly uploaded before: 8 MB of 10 MB is saved. Select OK to continue the upload from there.'
			)
		).toBeInTheDocument();
	});

	it('counts the files when several wait', () => {
		render(<ResumeUploadDialog uploads={[RIVER, FOREST]} onConfirm={() => {}} />);

		expect(screen.getByRole('dialog', { name: 'Parts of these files are already uploaded' })).toBeVisible();
		expect(
			screen.getByText(
				'2 files were partly uploaded before. Select OK to continue each upload from the part that is saved.'
			)
		).toBeInTheDocument();
	});

	it('confirms with the OK button', async () => {
		const onConfirm = vi.fn();
		render(<ResumeUploadDialog uploads={[RIVER]} onConfirm={onConfirm} />);

		await userEvent.click(screen.getByRole('button', { name: 'OK' }));

		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it('confirms when the dialog is closed from the keyboard, so the upload never stays waiting', async () => {
		const onConfirm = vi.fn();
		render(<ResumeUploadDialog uploads={[RIVER]} onConfirm={onConfirm} />);

		await userEvent.keyboard('{Escape}');

		expect(onConfirm).toHaveBeenCalledOnce();
	});
});
