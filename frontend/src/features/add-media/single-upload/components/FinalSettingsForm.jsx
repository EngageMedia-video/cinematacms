import { DateChooserField, RadioButton, Text, formatDMY } from '../../../shared/components';
import { Button } from '../../../shared/components/Button';
import { CheckboxButton } from '../../../shared/components/CheckboxButton';
import { TextField } from '../../../shared/components/TextField';
import { FieldGroup } from './FieldGroup';

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'unlisted', label: 'Unlisted' },
];

function todayIso() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${month}-${day}`;
}

function diffInDays(startIso, endIso) {
	const start = new Date(startIso);
	const end = new Date(endIso);
	return Math.max(0, Math.ceil((end - start) / 86400000));
}

export function FinalSettingsForm({ singleUpload }) {
	const effectiveStart = singleUpload.startDate || todayIso();
	const visibleDays = singleUpload.endDate ? diffInDays(effectiveStart, singleUpload.endDate) : 0;

	function toggleRequirePassword(event) {
		singleUpload.setRequirePassword(event.target.checked);
	}

	function toggleExpire(event) {
		singleUpload.setExpireEnabled(event.target.checked);
	}

	return (
		<FieldGroup title="Final Settings">
			<div className="flex flex-col">
				<CheckboxButton name="enable_comments">Enable Comments</CheckboxButton>

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
						{STATUS_OPTIONS.map((option) => (
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

				<div className="my-4 border-b border-b-border-divider" />

				<div className="flex items-center justify-between gap-4">
					<CheckboxButton checked={singleUpload.requirePassword} onChange={toggleRequirePassword}>
						Require Password
					</CheckboxButton>

					{singleUpload.requirePassword && !singleUpload.isEditingPassword ? (
						<Button
							variant="text"
							className="body-body-14-bold uppercase text-text-accent"
							onClick={singleUpload.beginEditingPassword}
						>
							Edit Password
						</Button>
					) : null}
				</div>

				{singleUpload.requirePassword && singleUpload.isEditingPassword ? (
					<TextField
						className="w-full"
						id="password"
						name="password"
						type="text"
						label="Enter Password"
						placeholder="Write here..."
						value={singleUpload.passwordDraft}
						onChange={(event) => singleUpload.setPasswordDraft(event.target.value)}
						rightButtonLabel="Save"
						onRightButtonClick={singleUpload.savePassword}
					/>
				) : null}

				{singleUpload.requirePassword && !singleUpload.isEditingPassword ? (
					<input type="hidden" name="password" value={singleUpload.savedPassword} readOnly />
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
			</div>
		</FieldGroup>
	);
}
