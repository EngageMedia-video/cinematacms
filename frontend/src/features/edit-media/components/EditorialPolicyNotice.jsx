import { Card, Text } from '../../shared/components';
import { TextAlert } from '../../shared/components/TextAlert';

export function EditorialPolicyNotice() {
	return (
		<Card className="px-6 py-5">
			<TextAlert role="note">
				<Text variant="body-16" color="description" className="m-0">
					Please check our&nbsp;
					<a
						href="/editorial-policy"
						className="text-text-accent no-underline underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					>
						Editorial Policy
					</a>
					&nbsp;before uploading media. Any media that does not comply with the policy will be deleted from
					Cinemata.org.
				</Text>
			</TextAlert>
		</Card>
	);
}
