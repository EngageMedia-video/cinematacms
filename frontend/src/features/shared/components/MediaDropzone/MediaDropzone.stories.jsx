import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { MediaDropzone } from './MediaDropzone';

const meta = {
	title: 'Components/Inputs/Media Dropzone',
	component: MediaDropzone,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Shared drag-and-drop media upload surface with a dashed strait-blue border, centered upload messaging, and a button-triggered hidden file input. It supports both dropping files and clicking the button to open the native picker.',
			},
		},
	},
	args: {
		label: 'Drag & Drop Files(s) or',
		buttonLabel: 'CHOOSE MEDIA',
		'aria-label': 'Choose media files',
	},
	argTypes: {
		label: {
			control: 'text',
			description: 'Supporting label shown between the icon and the button.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Drag & Drop Files(s) or'" },
			},
		},
		buttonLabel: {
			control: 'text',
			description: 'Text label rendered inside the choose-media button.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'CHOOSE MEDIA'" },
			},
		},
		accept: {
			control: 'text',
			description: 'Native file input accept string used to filter selectable file types.',
			table: {
				type: { summary: 'string' },
			},
		},
		multiple: {
			control: 'boolean',
			description: 'Allows selecting or dropping more than one file at a time.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'true' },
			},
		},
		disabled: {
			control: 'boolean',
			description: 'Disables drag/drop and file picking interactions.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		onFilesSelected: {
			action: 'files-selected',
			description: 'Called with an array of files after dropping or picking media.',
			table: {
				type: { summary: '(files: File[]) => void' },
			},
		},
		className: {
			control: 'text',
			description: 'Optional extra class applied to the outer full-width dropzone shell.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		iconName: {
			control: false,
			description: 'Shared icon name used for the large upload illustration.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'upload'" },
			},
		},
		buttonIconName: {
			control: false,
			description: 'Shared icon name rendered inside the choose-media button.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'uploadSmall'" },
			},
		},
	},
	render: (args) => (
		<div className="w-[600px] bg-cinemata-neutral-100 dark:bg-cinemata-pacific-deep-950">
			<MediaDropzone {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Drag & Drop Files(s) or')).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'CHOOSE MEDIA' })).toBeVisible();
		await expect(canvasElement.querySelector('[data-dropzone-icon]')).not.toBeNull();
	},
};

export const Disabled = {
	args: {
		disabled: true,
	},
};

export const WithSelectionState = {
	render: (args) => {
		const [selectedNames, setSelectedNames] = useState([]);

		return (
			<div className="w-full min-w-[320px] max-w-[1060px] bg-cinemata-neutral-100 p-4 dark:bg-cinemata-pacific-deep-950 sm:p-8">
				<MediaDropzone
					{...args}
					onFilesSelected={(files) => {
						setSelectedNames(files.map((file) => file.name));
						args.onFilesSelected?.(files);
					}}
				/>

				{selectedNames.length ? (
					<p className="body-body-14-regular mt-4 text-cinemata-pacific-deep-300">
						Last selected: {selectedNames.join(', ')}
					</p>
				) : null}
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'CHOOSE MEDIA' }));
	},
};
