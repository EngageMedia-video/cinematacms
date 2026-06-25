import { Card, Text } from '../../../shared/components';

export function FieldGroup({ children, description, headerAside = null, title }) {
	return (
		<Card className="py-8 px-6">
			<div className="flex items-start justify-between gap-6">
				<div className="min-w-0">
					<Text variant="h6-medium" as="h2" className="m-0 text-text-strong">
						{title}
					</Text>

					{description ? (
						<Text variant="body-14" color="meta" className="m-0 mt-2">
							{description}
						</Text>
					) : null}
				</div>
				{headerAside ? <div className="hidden shrink-0 md:block">{headerAside}</div> : null}
			</div>

			<div className="my-6 border-b border-b-border-divider" />

			<div className="grid gap-5">{children}</div>
		</Card>
	);
}
