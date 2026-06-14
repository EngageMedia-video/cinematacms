import { expect, within } from 'storybook/test';
import { UploadMediaItem } from './UploadMediaItem';

const sampleThumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
		<rect width="72" height="72" rx="8" fill="#0B3144" />
		<path d="M0 54c13-12 25-18 36-18s23 6 36 18v18H0V54z" fill="#D8785D"/>
		<circle cx="52" cy="18" r="11" fill="#8ED0D6" opacity=".9"/>
	</svg>
`)}`;

const baseArgs = {
	title: 'Memory of the Islands rough cut.mp4',
	fileSize: 1024 ** 2 * 8.4,
	progress: 72,
	regularUserMaxFiles: 1,
	trustedUserMaxFiles: 10,
	thumbnailSrc: '',
};

const meta = {
	title: 'Components/Feedback/Upload Media Item',
	component: UploadMediaItem,
	tags: ['autodocs'],
	args: {
		...baseArgs,
		status: 'uploading',
	},
	argTypes: {
		status: {
			control: 'radio',
			options: ['uploading', 'paused', 'complete', 'failed'],
			description: 'Visual upload state for the file row.',
		},
		progress: {
			control: 'number',
			description: 'Upload progress percentage from 0 to 100.',
		},
		fileSize: {
			control: 'text',
			description: 'File size as bytes or a preformatted string.',
		},
		includeFineUploaderSelectors: {
			control: 'boolean',
			description: 'Adds legacy Fine Uploader selector classes for integration templates.',
		},
		onCancel: { action: 'cancel', table: { disable: true } },
		onContinue: { action: 'continue', table: { disable: true } },
		onDelete: { action: 'delete', table: { disable: true } },
		onPause: { action: 'pause', table: { disable: true } },
		onRetry: { action: 'retry', table: { disable: true } },
		onReupload: { action: 'reupload', table: { disable: true } },
	},
	render: (args) => (
		<div className="w-full max-w-[640px] bg-bg-page p-6">
			<UploadMediaItem {...args} />
		</div>
	),
};

export default meta;

export const Uploading = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('progressbar', { name: /upload progress/i })).toHaveAttribute(
			'aria-valuenow',
			'72'
		);
		await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible();
	},
};

export const Paused = {
	args: {
		status: 'paused',
		progress: 42,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Paused')).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Continue' })).toBeVisible();
	},
};

export const Complete = {
	args: {
		status: 'complete',
		progress: 100,
		thumbnailSrc: sampleThumbnail,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/100%/)).toBeVisible();
		await expect(canvas.getByText('Complete')).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Reupload' })).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Delete' })).toBeVisible();
	},
};

export const Failed = {
	args: {
		status: 'failed',
		progress: 18,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getAllByText('Upload failed')[0]).toBeVisible();
		await expect(canvas.getByText(/You can upload 1 files max as a Regular User/i)).toBeVisible();
		await expect(canvas.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
		await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible();
	},
};

export const Gallery = {
	render: () => (
		<div className="grid w-full max-w-[720px] gap-4 bg-bg-page p-6">
			<UploadMediaItem {...baseArgs} status="uploading" progress={36} />
			<UploadMediaItem {...baseArgs} status="paused" progress={58} />
			<UploadMediaItem {...baseArgs} status="complete" progress={100} thumbnailSrc={sampleThumbnail} />
			<UploadMediaItem {...baseArgs} status="failed" progress={18} />
		</div>
	),
};
