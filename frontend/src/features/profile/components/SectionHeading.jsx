import { Text } from '../../shared/components';

export function SectionHeading({ id, heading, subtext }) {
	return (
		<header className="mb-6">
			<Text as="h2" id={id} variant="h4-bold" className="m-0 text-text-primary">
				{heading}
			</Text>
			<Text as="p" variant="body-14" className="mt-1 mb-0 italic text-text-muted">
				{subtext}
			</Text>
		</header>
	);
}
