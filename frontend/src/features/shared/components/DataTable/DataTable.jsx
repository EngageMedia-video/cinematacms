import { Text } from '../Text';
import { cn } from '../../utils/classNames';

/** Columns: {key, label, render(row), rowHeader?, align?: 'left' | 'right'}. */
export function DataTable({
	caption,
	columns,
	rows,
	rowKey,
	responsive = false,
	stickyHeader = false,
	className = '',
}) {
	const rowHeading = columns.find((column) => column.rowHeader);
	return (
		<>
			<div
				role="region"
				aria-label={caption}
				tabIndex={0}
				className={cn(
					'overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus',
					responsive && 'hidden md:block',
					className
				)}
			>
				<table className="w-full border-collapse">
					<Text as="caption" variant="body-14" className="sr-only">
						{caption}
					</Text>
					<thead
						className={cn(
							'border-b border-border-divider',
							stickyHeader && 'sticky top-0 bg-bg-surface-muted'
						)}
					>
						<tr>
							{columns.map((column) => (
								<Text
									key={column.key}
									as="th"
									scope="col"
									variant="body-12-medium"
									className={cn(
										'whitespace-nowrap px-4 py-3 text-text-secondary',
										column.align === 'right' ? 'text-right' : 'text-left'
									)}
								>
									{column.label}
								</Text>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={rowKey(row)} className="hover:bg-bg-surface-muted">
								{columns.map((column) => (
									<Text
										key={column.key}
										as={column.rowHeader ? 'th' : 'td'}
										scope={column.rowHeader ? 'row' : undefined}
										variant="body-14"
										className={cn(
											'px-4 py-3 tabular-nums',
											column.align === 'right' ? 'text-right' : 'text-left'
										)}
									>
										{column.render(row)}
									</Text>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{responsive && (
				<div className="space-y-4 md:hidden">
					{rows.map((row) => (
						<article key={rowKey(row)} className="py-4">
							{rowHeading && rowHeading.render(row)}
							<dl className="m-0 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
								{columns
									.filter((column) => column !== rowHeading)
									.map((column) => (
										<div key={column.key}>
											<Text as="dt" variant="body-12" color="meta">
												{column.label}
											</Text>
											<Text
												as="dd"
												variant="body-14-medium"
												className="m-0 mt-1 tabular-nums text-text-strong"
											>
												{column.render(row)}
											</Text>
										</div>
									))}
							</dl>
						</article>
					))}
				</div>
			)}
		</>
	);
}
