import { Text } from '../../../shared/components/Text/Text.jsx';

export function MediaMetaField(props) {
	return (
		<div className="grid grid-cols-[155px_1fr] gap-3">
			<Text as="span" variant="body-14" className="m-0 text-text-muted">
				{props.title}
			</Text>

			<Text as="span" variant="body-14" className="m-0 min-w-0 wrap-break-word">
				{props.value}
			</Text>
		</div>
	);
}
