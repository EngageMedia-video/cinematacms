import {
	AllowDownloadCheckbox,
	EnableCommentsCheckbox,
	RestrictedPasswordField,
	StatusRadioGroup,
	StreamProtectionField,
	VisibilityExpirationField,
} from '../../../shared/components/UploadMedia';
import { FieldGroup } from './FieldGroup';

export function FinalSettingsForm({ singleUpload, canUseRestrictedStatus = false }) {
	return (
		<FieldGroup title="Final Settings">
			<div className="flex flex-col">
				<EnableCommentsCheckbox
					checked={singleUpload.enableComments}
					onChange={singleUpload.setEnableComments}
				/>

				<AllowDownloadCheckbox checked={singleUpload.allowDownload} onChange={singleUpload.setAllowDownload} />

				<div className="my-4 border-b border-b-border-divider" />

				<StatusRadioGroup
					name="state"
					value={singleUpload.mediaStatus}
					includeRestricted={canUseRestrictedStatus}
					onChange={(value) => {
						if (value === 'private') singleUpload.setExpireEnabled(false);
						singleUpload.setMediaStatus(value);
					}}
				/>

				{singleUpload.mediaStatus === 'restricted' ? (
					<RestrictedPasswordField
						id="password"
						name="password"
						password={singleUpload.password}
						onPasswordChange={singleUpload.setPassword}
						error={singleUpload.errors.password}
					/>
				) : null}

				{singleUpload.mediaStatus !== 'private' ? (
					<>
						<div className="my-4 border-b border-b-border-divider" />

						<VisibilityExpirationField
							expireEnabled={singleUpload.expireEnabled}
							startDate={singleUpload.startDate}
							endDate={singleUpload.endDate}
							mediaStatus={singleUpload.mediaStatus}
							onToggle={singleUpload.setExpireEnabled}
							onStartDateChange={singleUpload.setStartDate}
							onEndDateChange={singleUpload.setEndDate}
						/>
					</>
				) : null}

				<div className="my-4 border-b border-b-border-divider" />

				<StreamProtectionField checked={singleUpload.isEncrypted} onChange={singleUpload.setIsEncrypted} />
			</div>
		</FieldGroup>
	);
}
