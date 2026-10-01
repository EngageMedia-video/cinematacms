import { Text } from '../Text';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Tooltip } from '../Tooltip';
import { cn } from '../../utils/classNames';

/** A label/value pair. A grid definition list aligns labels and values via subgrid. */
export function Statistic({ label, value, description, comparison, className = '' }) {
	return (
		<div className={cn('row-span-2 grid min-w-0 grid-rows-subgrid gap-2 py-3', className)}>
			<Text as="dt" variant="body-14-medium" className="m-0">
				{description || comparison ? (
					<Tooltip
						trigger="click"
						placement="bottom"
						contentClassName="p-3 leading-5"
						content={
							<>
								{description && (
									<Text as="p" variant="body-14" className="m-0">
										{description}
									</Text>
								)}
								{comparison && (
									<Text as="p" variant="body-12" className={description ? 'mt-2 mb-0' : 'm-0'}>
										{comparison}
									</Text>
								)}
							</>
						}
					>
						<Button
							variant="text"
							align="left"
							aria-label={`About ${label.toLowerCase()}`}
							icon={<Icon name="infoCircle" size={16} decorative />}
							iconPosition="right"
							className="min-h-11 gap-1 text-left font-medium text-text-primary normal-case focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-link [&]:p-0"
							textClassName="text-left leading-6"
						>
							{label}
						</Button>
					</Tooltip>
				) : (
					label
				)}
			</Text>
			<Text as="dd" variant="h4-bold" className="m-0 break-words font-sans tabular-nums text-text-primary">
				{value}
			</Text>
		</div>
	);
}
