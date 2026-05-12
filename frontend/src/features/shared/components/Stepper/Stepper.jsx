import { Icon } from '../Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

export function Stepper({
	label = 'Featured In...',
	items = [],
	iconName = 'eye',
	className = '',
	linkLabel = 'VISIT LINK',
}) {
	return (
		<div className={joinClasses('w-full', className)} data-stepper>
			<div className="flex gap-6">
				<div className="inline-flex p-2 shrink-0 items-center justify-center rounded-full bg-cinemata-neutral-200 text-cinemata-strait-blue-600p dark:bg-cinemata-pacific-deep-800 dark:text-cinemata-strait-blue-200">
					<Icon name={iconName} decorative data-stepper-icon />
				</div>
				<p className="body-body-14-regular m-0 p-0 text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-300 mt-1">
					{label}
				</p>
			</div>

			<div>
				{items.map((item, index) => (
					<div key={`${item.title}-${index}`} className="flex gap-11 mx-4">
						<div className="flex shrink-0 flex-col items-center" aria-hidden="true">
							<span
								className={joinClasses(
									'w-px h-4 bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-600p',
									index == 0 ? 'mt-2' : ''
								)}
								data-stepper-line
							/>

							{index > 0 ? (
								<span
									className="my-[10px] h-[6px] w-[6px] rounded-full bg-cinemata-neutral-400 dark:bg-cinemata-strait-blue-200"
									data-stepper-dot
								/>
							) : (
								<div className="w-[6px]">
									<span
										className="w-px flex-1 bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-600p"
										data-stepper-dot
									/>
								</div>
							)}

							<span
								className="w-px flex-1 bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-600p"
								data-stepper-line
							/>
						</div>

						<div className="min-w-0 flex-1 flex flex-col mb-6 gap-2">
							<p className="body-body-16-regular p-0 m-0 text-cinemata-neutral-900 dark:text-cinemata-pacific-deep-50">
								{item.title}
							</p>

							<div className="flex flex-wrap items-center gap-3">
								{item.date ? (
									<span className="body-body-14-regular text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-300">
										{item.date}
									</span>
								) : null}

								{item.date && item.href ? (
									<span
										aria-hidden="true"
										className="h-[6px] w-[6px] rounded-full bg-cinemata-neutral-400 dark:bg-cinemata-pacific-deep-300"
									/>
								) : null}

								{item.href ? (
									<a
										href={item.href}
										target="_blank"
										rel="noreferrer"
										className="body-body-14-bold text-cinemata-sunset-horizon-600 dark:text-cinemata-sunset-horizon-400p no-underline"
									>
										{item.linkLabel ?? linkLabel}
									</a>
								) : null}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
