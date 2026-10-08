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
		const body = within(document.body);

		await expect(await body.findByRole('dialog', { name: 'Add community impact' })).toBeVisible();
		await expect(body.getByRole('radiogroup', { name: 'What kind of impact?' })).toBeVisible();
	},
};

export const Screening = {
	play: async () => {
		const body = within(document.body);

		await userEvent.click(await body.findByRole('radio', { name: /^Screening/ }));
		await expect(body.getByLabelText('Event or Festival Name')).toBeVisible();
		await expect(body.getByText('Keep organiser private')).toBeVisible();
	},
};

export const Award = {
	play: async () => {
		const body = within(document.body);

		await userEvent.click(await body.findByRole('radio', { name: /^Award/ }));
		await expect(body.getByLabelText('Award Name')).toBeVisible();
		await expect(body.getByLabelText('Citation (optional)')).toBeVisible();
	},
};

export const SubmitReady = {
	play: async ({ args }) => {
		const body = within(document.body);

		await userEvent.click(await body.findByRole('radio', { name: /^Article or Review/ }));
		await userEvent.type(body.getByLabelText('Title'), 'Films that changed the conversation');
		await userEvent.type(body.getByLabelText('Year'), '2023');
		await userEvent.type(body.getByLabelText('Written by'), 'Dewi Lestari');
		await userEvent.click(body.getByRole('button', { name: 'ADD IMPACT' }));

		await expect(args.onSubmit).toHaveBeenCalledWith({
			category: 'article',
			title: 'Films that changed the conversation',
			year: 2023,
			creator: 'Dewi Lestari',
			publication: '',
			details: '',
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
