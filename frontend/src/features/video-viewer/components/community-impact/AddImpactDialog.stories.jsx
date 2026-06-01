import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from '../../../shared/components';
import { AddImpactDialog } from './AddImpactDialog';

function DialogStory(args) {
	const [open, setOpen] = useState(args.open);

	return (
		<div className="bg-bg-page p-space-lg">
			<Button onClick={() => setOpen(true)}>ADD IMPACT</Button>
			<AddImpactDialog {...args} open={open} onClose={() => setOpen(false)} />
		</div>
	);
}

const meta = {
	title: 'Features/Video Viewer/Community Impact/AddImpactDialog',
	component: AddImpactDialog,
	tags: ['autodocs'],
	args: {
		onSubmit: fn(),
		open: true,
	},
	render: (args) => <DialogStory {...args} />,
};

export default meta;

export const Open = {
	play: async () => {
		await expect(await within(document.body).findByRole('dialog', { name: 'Add community impact' })).toBeVisible();
		await expect(within(document.body).getByText('Maximum 80 Words')).toBeVisible();
	},
};

export const SubmitReady = {
	play: async ({ args }) => {
		const body = within(document.body);

		await userEvent.type(body.getByLabelText('Where did you see this film'), 'Jakarta community hall');
		await userEvent.click(body.getByRole('button', { name: 'Select community impact category' }));
		await userEvent.click(body.getByRole('menuitemradio', { name: 'Screened In' }));
		await userEvent.click(body.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		await expect(args.onSubmit).toHaveBeenCalledWith({
			category: 'screening',
			details: '',
			link: '',
			location: 'Jakarta community hall',
			title: 'Jakarta community hall',
			url: '',
		});
	},
};

export const Mobile = {
	parameters: {
		viewport: {
			defaultViewport: 'mobile1',
		},
	},
};
