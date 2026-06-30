import { Link, Text } from '../../../shared/components';

export function ManageUploadsSection() {
	return (
		<div className="flex flex-col items-start gap-4">
			<Text as="h3" variant="h6-bold" className="m-0 text-text-primary">
				Your upload workspace
			</Text>
			<Text as="p" variant="body-14" className="m-0 max-w-2xl text-text-muted">
				Open the upload manager to edit film details, visibility, processing, and publishing settings.
			</Text>
			<Link href="/manage/uploads" variant="primary">
				Manage Uploads
			</Link>
		</div>
	);
}
