import { FieldGroup } from '../../add-media/single-upload/components/FieldGroup';
import { Text } from '../../shared/components';
import { CheckboxButton } from '../../shared/components/CheckboxButton';

export function AdvancedSettingsSection({ config, editState }) {
	if (!config.permissions?.canUseWhisperTranslate) {
		return null;
	}

	return (
		<FieldGroup title="Advanced Settings">
			<div className="grid gap-3">
				<Text variant="body-16-bold" className="m-0 text-text-strong">
					Automatic Speech Recognition (Beta)
				</Text>
				<CheckboxButton
					name="allow_whisper_transcribe_and_translate"
					checked={editState.allowWhisperTranslate}
					onChange={(event) => editState.setAllowWhisperTranslate(event.target.checked)}
				>
					Translate to English
				</CheckboxButton>
				<Text variant="body-12" className="m-0 text-text-muted">
					To view or edit auto-generated subtitles, go to the media page and choose Edit Subtitles after
					uploading the video file.
				</Text>
			</div>
		</FieldGroup>
	);
}
