import { CheckboxButton } from '../../CheckboxButton';

// Controlled admin-only fields shared by single upload and bulk per-file
// metadata forms.

function FeaturedCheckbox({ checked = false, onChange, name = 'featured' }) {
	return (
		<CheckboxButton name={name} checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Featured
		</CheckboxButton>
	);
}

export function AdminSettingsFields({ featured = false, onChange, featuredName = 'featured' }) {
	return (
		<div className="flex flex-col gap-5">
			<FeaturedCheckbox
				name={featuredName}
				checked={featured}
				onChange={(next) => onChange?.({ featured: next })}
			/>
		</div>
	);
}
