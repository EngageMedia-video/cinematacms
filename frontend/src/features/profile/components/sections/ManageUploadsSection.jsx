import { Link } from '../../../shared/components';

export function ManageUploadsSection() {
	return (
		<div className="flex flex-col items-start gap-4">
			<Link href="/manage/uploads" variant="primary">
				Manage Uploads
			</Link>
		</div>
	);
}
