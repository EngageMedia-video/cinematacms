import { Text } from '../../shared/components/Text';

export function IdleHint() {
	return (
		<div className="flex flex-col gap-1 px-6 py-10 text-center">
			<Text variant="body-14" className="m-0 text-text-on-chrome">
				Search Cinemata
			</Text>
			<Text variant="body-12" className="m-0 text-text-on-chrome-muted">
				Find videos, playlists, and members.
			</Text>
		</div>
	);
}
