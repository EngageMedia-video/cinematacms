import { useEffect, useState } from 'react';
import { QuickPreview } from '../../../upload-quick-preview';
import { useBulkUploadConfig } from '../bulkUploadConfig';

// Per-file Quick Preview shared by the Enter-Details cards (step 2) and the
// Preview & Submit summary (step 3), so both show the same thing: a chosen
// thumbnail (rendered from its object URL) takes precedence over the uploaded
// media's auto thumbnail.
export function FileQuickPreview({ file, options = {}, className = '' }) {
	const meta = file.metadata || {};
	const { userName } = useBulkUploadConfig();

	const [posterPreviewUrl, setPosterPreviewUrl] = useState('');
	useEffect(() => {
		if (!file.posterFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
			setPosterPreviewUrl('');
			return undefined;
		}
		const url = URL.createObjectURL(file.posterFile);
		setPosterPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file.posterFile]);

	const countryLabel = options.countries?.find((country) => country.code === meta.media_country)?.title || '';
	const firstCategoryId = Array.isArray(meta.category) ? meta.category[0] : undefined;
	const firstCategory = options.categories?.find((category) => String(category.id) === String(firstCategoryId));
	const previewCategory = firstCategory ? { title: firstCategory.title } : null;

	return (
		<QuickPreview
			title={meta.title}
			thumbnailUrl={posterPreviewUrl || file.thumbnailUrl || ''}
			thumbnailFrame={file.thumbnailFrame}
			subtitle={userName || ''}
			country={countryLabel}
			category={previewCategory}
			views={0}
			className={className}
		/>
	);
}
