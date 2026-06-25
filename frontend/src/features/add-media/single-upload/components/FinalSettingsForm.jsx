import { useState } from 'react';
import { DateChooserField, RadioButton, Text, formatDMY } from '../../../shared/components';
import { CheckboxButton } from '../../../shared/components/CheckboxButton';
import { TextField } from '../../../shared/components/TextField';
import { diffInDays, todayIso } from '../../utils/helpers';
import { FieldGroup } from './FieldGroup';

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'restricted', label: 'Restricted' },
	{ value: 'unlisted', label: 'Unlisted' },
];

export function FinalSettingsForm({ singleUpload, canUseRestrictedStatus = false }) {
	const [showPassword, setShowPassword] = useState(false);
	const effectiveStart = singleUpload.startDate || todayIso();
	const visibleDays = singleUpload.endDate ? diffInDays(effectiveStart, singleUpload.endDate) : 0;
	const statusOptions = canUseRestrictedStatus
		? STATUS_OPTIONS
		: STATUS_OPTIONS.filter((option) => option.value !== 'restricted');

	function toggleExpire(event) {
		singleUpload.setExpireEnabled(event.target.checked);
	}

	return (
		<FieldGroup title="Final Settings">
			<div className="flex flex-col">
				<CheckboxButton
					name="enable_comments"
					checked={singleUpload.enableComments}
					onChange={(event) => singleUpload.setEnableComments(event.target.checked)}
				>
					Enable Comments
				</CheckboxButton>

				<CheckboxButton
					name="allow_download"
					checked={singleUpload.allowDownload}
					onChange={(event) => singleUpload.setAllowDownload(event.target.checked)}
				>
					Allow Download
				</CheckboxButton>

				<div className="my-4 border-b border-b-border-divider" />

				<fieldset className="m-0 border-0 p-0">
					<legend className="body-body-16-regular mb-2 text-text-muted">Status</legend>
					<div className="flex flex-wrap items-center gap-6">
						{statusOptions.map((option) => (
							<RadioButton
								key={option.value}
								name="state"
								value={option.value}
								controlClassName="bg-bg-surface-hover"
								checked={singleUpload.mediaStatus === option.value}
								onChange={() => singleUpload.setMediaStatus(option.value)}
							>
								{option.label}
							</RadioButton>
						))}
					</div>
				</fieldset>

				{singleUpload.mediaStatus === 'restricted' ? (
					<TextField
						className="w-full"
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						label="Enter Password"
						placeholder="Write here..."
						value={singleUpload.password}
						onChange={(event) => singleUpload.setPassword(event.target.value)}
						invalid={Boolean(singleUpload.errors.password)}
						helperText={singleUpload.errors.password || ''}
						autoComplete="new-password"
						rightButtonLabel={showPassword ? 'Hide' : 'Show'}
						onRightButtonClick={() => setShowPassword((visible) => !visible)}
					/>
				) : null}

				<div className="my-4 border-b border-b-border-divider" />

				<CheckboxButton checked={singleUpload.expireEnabled} onChange={toggleExpire}>
					Set Visibility Expiration
				</CheckboxButton>

				{singleUpload.expireEnabled ? (
					<>
						<div className="flex flex-col gap-4 sm:flex-row">
							<DateChooserField
								id="visibility_start"
								name="visibility_start"
								label="Enter Start Date"
								value={singleUpload.startDate}
								onChange={singleUpload.setStartDate}
							/>

							<DateChooserField
								id="visibility_end"
								name="visibility_end"
								label="Enter End Date"
								value={singleUpload.endDate}
								min={singleUpload.startDate || todayIso()}
								onChange={singleUpload.setEndDate}
							/>
						</div>

						{singleUpload.endDate ? (
							<Text variant="body-14" color="meta" className="m-0">
								Your film will be visible for {visibleDays} days, starting {formatDMY(effectiveStart)}{' '}
								to {formatDMY(singleUpload.endDate)}
							</Text>
						) : null}
					</>
				) : null}

				<div className="my-4 border-b border-b-border-divider" />

				<div>
					<span className="body-body-16-regular mb-2 block text-text-muted">Stream Protection</span>
					<div className="flex flex-row items-start gap-2">
						<CheckboxButton
							name="is_encrypted"
							className="mt-0.5"
							aria-label="Encrypt this video&rsquo;s stream"
							checked={singleUpload.isEncrypted}
							onChange={(event) => singleUpload.setIsEncrypted(event.target.checked)}
						/>
						<div className="flex flex-col gap-2">
							<Text className="m-0" variant="body-16">
								Encrypt this video&rsquo;s stream
							</Text>
							<Text className="m-0" variant="body-12">
								Adds an extra layer of protection so only authorized viewers can watch this film. If your
								video has already been processed, enabling this will trigger a re-encoding, which may take
								a few minutes.
							</Text>
						</div>
					</div>
				</div>
			</div>
		</FieldGroup>
	);
}
