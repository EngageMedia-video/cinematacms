import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { UploadMediaItem } from './UploadMediaItem';

describe('UploadMediaItem', () => {
	it('renders uploading progress with pause and cancel actions', async () => {
		const user = userEvent.setup();
		const onPause = vi.fn();

		render(<UploadMediaItem title="Road home.mp4" fileSize={1024 ** 2 * 7.5} progress={80} onPause={onPause} />);

		expect(screen.getByText('Road home.mp4')).toBeInTheDocument();
		expect(screen.getByRole('progressbar', { name: 'Road home.mp4 upload progress' })).toHaveAttribute(
			'aria-valuenow',
			'80'
		);
		expect(screen.getByText('80% (7.5 MB)')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Pause' }));

		expect(onPause).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});

	it('renders complete state with green completion copy and completion actions', () => {
		render(<UploadMediaItem status="complete" title="Finished.mp4" fileSize="12 MB" />);

		expect(screen.getByText('Complete')).toHaveClass('text-text-success');
		expect(screen.getByText('100% (12 MB)')).toHaveClass('text-text-muted');
		expect(screen.getByRole('button', { name: 'Reupload' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('renders failed state with retry and delete actions', () => {
		render(<UploadMediaItem status="failed" title="Broken.mp4" />);

		expect(screen.getAllByText('Upload failed')[0]).toHaveClass('text-text-danger');
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
		expect(screen.getByText('Broken.mp4').closest('article')).toHaveClass('bg-bg-surface');
		expect(screen.getByText('Broken.mp4').closest('article')).not.toHaveClass(
			'border-border-danger',
			'bg-bg-danger-subtle/30'
		);
	});
});
