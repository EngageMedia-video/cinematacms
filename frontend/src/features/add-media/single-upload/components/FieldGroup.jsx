import { Card, Text } from '../../../shared/components';

export function FieldGroup({ children, description, title }) {
	return (
		<Card className="py-8 px-6">
			<Text variant="h6-medium" as="h2" className="m-0 text-text-strong">
				{title}
			</Text>

			{description ? (
				<Text variant="body-14" color="meta" className="m-0 mt-2">
					{description}
				</Text>
			) : null}

			<div className="my-6 border-b border-b-border-divider" />

			<div className="grid gap-5">{children}</div>
		</Card>
	);
}
