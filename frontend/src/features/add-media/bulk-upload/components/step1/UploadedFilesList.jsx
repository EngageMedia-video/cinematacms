import { UploadFileRow } from './UploadFileRow';

export function UploadedFilesList({ files = [], maxFiles }) {
	if (files.length === 0) {
		return null;
	}

	return (
		<section aria-label="Uploaded files" className="mt-8">
			<div className="flex items-baseline justify-between gap-3">
				<h3 className="heading-h6-20-medium m-0 text-text-strong">Uploaded Files</h3>
				{maxFiles ? (
					<span className="body-body-12-regular text-text-muted">
						{files.length}/{maxFiles}
					</span>
				) : null}
			</div>
			<ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
				{files.map((file) => (
					<UploadFileRow key={file.id} file={file} />
				))}
			</ul>
		</section>
	);
}
