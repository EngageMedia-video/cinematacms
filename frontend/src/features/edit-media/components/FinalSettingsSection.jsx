import { FieldGroup } from '../../add-media/single-upload/components/FieldGroup';
import { Text } from '../../shared/components';
import { CheckboxButton } from '../../shared/components/CheckboxButton';
import { RadioButton } from '../../shared/components/RadioButton';
import { TextField } from '../../shared/components/TextField';
import { VisibilityExpirationField } from '../../shared/components/UploadMedia';

export function FinalSettingsSection({ config, editState }) {
	return (
		<FieldGroup title="Final Settings">
			<div className="flex flex-col gap-5">
				<CheckboxButton
					name="enable_comments"
					checked={editState.enableComments}
					onChange={(event) => editState.setEnableComments(event.target.checked)}
				>
					Enable Comments
				</CheckboxButton>

				<CheckboxButton
					name="allow_download"
					checked={editState.allowDownload}
					onChange={(event) => editState.setAllowDownload(event.target.checked)}
				>
					Allow Download
				</CheckboxButton>

				<div className="border-b border-b-border-divider" />

				<fieldset className="m-0 border-0 p-0">
					<legend className="body-body-16-regular mb-2 text-text-muted">Status</legend>
					<div className="flex flex-wrap items-center gap-6">
						{config.statusOptions.map((option) => (
							<RadioButton
								key={option.value}
								name="state"
								value={option.value}
								controlClassName="bg-bg-surface-hover"
								checked={editState.mediaStatus === option.value}
								onChange={() => {
									if (option.value === 'private') editState.setExpireEnabled(false);
									editState.setMediaStatus(option.value);
								}}
							>
								{option.label}
							</RadioButton>
						))}
					</div>
				</fieldset>

				{editState.mediaStatus === 'restricted' ? (
					<TextField
						className="w-full"
						id="password"
						name="password"
						type="password"
						label="Enter Password"
						placeholder={
							config.media?.hasPassword ? 'Leave blank to keep the current password' : 'Write here...'
						}
						value={editState.password}
						onChange={(event) => editState.setPassword(event.target.value)}
						invalid={Boolean(editState.errors.password)}
						helperText={editState.errors.password || ''}
						autoComplete="new-password"
					/>
				) : null}

				<div className="border-b border-b-border-divider" />

				{editState.mediaStatus !== 'private' ? (
					<VisibilityExpirationField
						expireEnabled={editState.expireEnabled}
						startDate={editState.startDate}
						endDate={editState.endDate}
						mediaStatus={editState.mediaStatus}
						onToggle={editState.setExpireEnabled}
						onStartDateChange={editState.setStartDate}
						onEndDateChange={editState.setEndDate}
					/>
				) : null}

				{config.permissions?.canUseEncryption ? (
					<>
						<div className="border-b border-b-border-divider" />
						<div>
							<span className="body-body-16-regular mb-2 block text-text-muted">Stream Protection</span>
							<div className="flex flex-row items-start gap-2">
								<CheckboxButton
									name="is_encrypted"
									className="mt-0.5"
									aria-label="Encrypt this video's stream"
									checked={editState.isEncrypted}
									onChange={(event) => editState.setIsEncrypted(event.target.checked)}
								/>
								<div className="flex flex-col gap-2">
									<Text className="m-0" variant="body-16">
										Encrypt this video's stream
									</Text>
									<Text className="m-0" variant="body-12">
										Only authorized viewers can watch the HLS stream. Changing this on processed
										video will trigger re-encoding.
									</Text>
								</div>
							</div>
						</div>
					</>
				) : null}
			</div>
		</FieldGroup>
	);
}
