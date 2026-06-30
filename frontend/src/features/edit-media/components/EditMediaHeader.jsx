import { Text } from '../../shared/components';

export function EditMediaHeader() {
	return (
		<div className="flex flex-col gap-3">
			<Text variant="h4" as="h1" className="m-0 text-text-strong">
				Edit Media
			</Text>
			<Text variant="body-16" className="m-0 max-w-[720px] text-text-muted">
				Update the media details, thumbnail, publishing settings, or upload a replacement video file.
			</Text>
		</div>
	);
}
