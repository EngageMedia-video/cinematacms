import {
	CategoryCheckboxGroup,
	CompanyField,
	ContentSensitivityGroup,
	LicenseChooser,
	MediaCountrySelect,
	MediaLanguageSelect,
	TagsField,
	TopicCheckboxGroup,
	WebsiteField,
} from '../../../shared/components/UploadMedia';
import { FieldGroup } from './FieldGroup';

const DEFAULT_LICENSES = [];

export function OtherDetailsForm({
	categories,
	contentSensitivities,
	licenses = DEFAULT_LICENSES,
	mediaCountries,
	mediaLanguages,
	singleUpload,
	topics,
}) {
	function handleLicenseChange(next) {
		if (Object.prototype.hasOwnProperty.call(next, 'no_license')) {
			singleUpload.setNoLicense(next.no_license);
		}

		if (next.custom_license) {
			singleUpload.applySelectedLicense(next.custom_license);
		}
	}

	return (
		<FieldGroup title="Other Details">
			<CompanyField
				id="production-company"
				name="company"
				value={singleUpload.company}
				onChange={singleUpload.setCompany}
			/>

			<WebsiteField
				id="website"
				name="website"
				value={singleUpload.website}
				onChange={singleUpload.setWebsite}
				error={singleUpload.errors.website}
			/>

			<MediaLanguageSelect
				id="media_language"
				name="media_language"
				options={mediaLanguages}
				value={singleUpload.mediaLanguage}
				onChange={singleUpload.setMediaLanguage}
				error={singleUpload.errors.media_language}
			/>

			<MediaCountrySelect
				id="media_country"
				name="media_country"
				options={mediaCountries}
				value={singleUpload.mediaCountry}
				onChange={singleUpload.setMediaCountry}
				error={singleUpload.errors.media_country}
			/>

			<div className="flex flex-col sm:flex-row gap-4 mt-3">
				<CategoryCheckboxGroup
					id="category"
					name="category"
					options={categories}
					value={singleUpload.category}
					onChange={singleUpload.setCategory}
					error={singleUpload.errors.category}
				/>

				<ContentSensitivityGroup
					name="content_sensitivity"
					options={contentSensitivities}
					value={singleUpload.contentSensitivity}
					onChange={singleUpload.setContentSensitivity}
				/>
			</div>

			<div className="flex flex-col sm:flex-row gap-4 mt-3">
				<TopicCheckboxGroup
					id="topics"
					name="topics"
					options={topics}
					value={singleUpload.topics}
					onChange={singleUpload.setTopics}
					error={singleUpload.errors.topics}
				/>
			</div>

			<TagsField id="tags" name="new_tags" value={singleUpload.tags} onChange={singleUpload.setTags} />

			<LicenseChooser
				name="custom-license"
				value={singleUpload.selectedLicenseId}
				noLicense={singleUpload.noLicense}
				options={licenses}
				hiddenInputName="custom_license"
				noLicenseName="no_license"
				labelId="custom-license-label"
				displayId="custom-license-display"
				onChange={handleLicenseChange}
			/>
		</FieldGroup>
	);
}
