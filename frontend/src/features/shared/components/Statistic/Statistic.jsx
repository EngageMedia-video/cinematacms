import { Text } from '../Text';
import { cn } from '../../utils/classNames';

/** A label/value pair inside a definition list. */
export function Statistic({ label, value, description, comparison, className = '' }) {
	return (
		<div className={cn('flex min-w-0 flex-col gap-2 py-3', className)}>
			<Text as="dt" variant="body-14-medium" className="m-0">
				{label}
			</Text>
			<Text as="dd" variant="h4-bold" className="m-0 break-words font-sans tabular-nums text-text-primary">
				{value}
			</Text>
			{comparison && (
				<Text as="dd" variant="body-12" className="m-0 tabular-nums">
					{comparison}
				</Text>
			)}
			{description && (
				<Text as="dd" variant="body-12" className="m-0 max-w-prose">
					{description}
				</Text>
			)}
		</div>
	);
}
