import { TextAlert } from '../../../shared/components';

export function AlertOwnershipMedia({ className }) {
	return (
		<TextAlert className={className}>
			Uploading to Cinemata does not transfer ownership. <br />
			You keep full rights and control over how your film is shared.
		</TextAlert>
	);
}
