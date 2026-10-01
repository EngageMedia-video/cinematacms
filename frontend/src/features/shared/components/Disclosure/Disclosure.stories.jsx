import { Disclosure } from './Disclosure';
import { Text } from '../Text';

export default {
	title: 'Components/Disclosure',
	component: Disclosure,
	args: { title: 'How these figures are measured' },
};

export const Default = {
	render: (args) => (
		<Disclosure {...args}>
			<Text className="m-0 max-w-prose">Watch time counts time spent actively watching a film.</Text>
		</Disclosure>
	),
};

export const Open = { ...Default, args: { open: true } };
