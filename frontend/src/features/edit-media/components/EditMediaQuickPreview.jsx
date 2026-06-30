import { useEffect, useState } from 'react';
import { QuickPreview } from '../../upload-quick-preview';

function findOptionLabel(options, value) {
	const option = options.find((item) => String(item.value) === String(value));
	return option?.label || '';
}

function firstValue(value) {
	return Array.isArray(value) ? value[0] : value;
}

export function EditMediaQuickPreview({ config, editState, className = '' }) {
	const [posterPreviewUrl, setPosterPreviewUrl] = useState('');

	useEffect(() => {
		if (
			!editState.selectedThumbnailFile ||
			typeof URL === 'undefined' ||
			typeof URL.createObjectURL !== 'function'
		) {
			setPosterPreviewUrl('');
			return undefined;
		}

		const url = URL.createObjectURL(editState.selectedThumbnailFile);
		setPosterPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [editState.selectedThumbnailFile]);

	const categoryValue = firstValue(editState.category);
	const categoryLabel = findOptionLabel(config.options.categories, categoryValue);
	const countryLabel = findOptionLabel(config.options.mediaCountries, editState.mediaCountry);
	const thumbnailFrame = posterPreviewUrl ? null : editState.thumbnailFrame;
	const thumbnailUrl = posterPreviewUrl || (thumbnailFrame ? '' : config.media?.posterUrl || '');

	return (
		<QuickPreview
			title={editState.title}
			subtitle={editState.company}
			country={countryLabel}
			category={categoryLabel ? { title: categoryLabel } : null}
			thumbnailUrl={thumbnailUrl}
			thumbnailFrame={thumbnailFrame}
			views={config.media?.views}
			className={className}
		/>
	);
}
