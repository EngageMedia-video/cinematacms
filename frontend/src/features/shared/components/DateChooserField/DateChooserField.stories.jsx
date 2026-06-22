import { useState } from 'react';
import { DateChooserField } from './DateChooserField';

const meta = {
	title: 'upload-media/DateChooserField',
	component: DateChooserField,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Read-only date field used in the upload-media form. The value is shown formatted as DD/MM/YYYY and the native date picker is opened via the CHOOSE button — the visible input never accepts typed text.',
			},
		},
	},
	args: {
		label: 'Enter Start Date',
		rightButtonLabel: 'Choose',
		placeholder: 'DD / MM / YYYY',
	},
	argTypes: {
		label: { control: 'text', description: 'Field label shown above the value.' },
		placeholder: { control: 'text', description: 'Placeholder shown when no date is selected.' },
		rightButtonLabel: { control: 'text', description: 'Label for the picker-opening button.' },
		value: { control: 'text', description: 'Selected date as an ISO string (YYYY-MM-DD).' },
		min: { control: 'text', description: 'Earliest selectable date as an ISO string.' },
		onChange: { action: 'changed', description: 'Called with the new ISO date string.' },
	},
};

export default meta;

function ControlledDateChooserField(args) {
	const [value, setValue] = useState(args.value ?? '');

	return (
		<DateChooserField
			{...args}
			value={value}
			onChange={(next) => {
				setValue(next);
				args.onChange?.(next);
			}}
		/>
	);
}

export const Default = {
	render: (args) => <ControlledDateChooserField {...args} />,
};

export const WithValue = {
	render: (args) => <ControlledDateChooserField {...args} />,
	args: {
		value: '2026-06-17',
	},
};

export const EndDate = {
	render: (args) => <ControlledDateChooserField {...args} />,
	args: {
		label: 'Enter End Date',
		min: '2026-06-17',
	},
};
