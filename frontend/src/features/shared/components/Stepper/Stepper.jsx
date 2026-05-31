import { cn } from '../../utils/classNames';
import { Icon } from '../Icon';

export function Stepper({
	label = 'Featured In...',
	items = [],
	iconName = 'eye',
	className = '',
	linkLabel = 'VISIT LINK',
}) {
	return (
		<div className={cn('w-full', className)} data-stepper>
			<div className="flex gap-6">
				<div className="inline-flex p-2 shrink-0 items-center justify-center rounded-full bg-bg-surface-muted text-text-secondary">
					<Icon name={iconName} decorative data-stepper-icon />
				</div>
				<p className="body-body-14-regular m-0 p-0 text-text-muted mt-1">{label}</p>
			</div>

			<div>
				{items.map((item, index) => (
					<div key={`${item.title}-${index}`} className="flex gap-11 mx-4">
						<div className="flex shrink-0 flex-col items-center" aria-hidden="true">
							<span
								className={cn('w-px h-4 bg-border-divider', index == 0 ? 'mt-2' : '')}
								data-stepper-line
							/>

							{index > 0 ? (
								<span
									className="my-[10px] h-[6px] w-[6px] rounded-full bg-border-strong"
									data-stepper-dot
								/>
							) : (
								<div className="w-[6px]">
									<span className="w-px flex-1 bg-border-divider" data-stepper-dot />
								</div>
							)}

							<span className="w-px flex-1 bg-border-divider" data-stepper-line />
						</div>

						<div className="min-w-0 flex-1 flex flex-col mb-6 gap-2">
							<p className="body-body-16-regular p-0 m-0 text-text-strong">{item.title}</p>

							<div className="flex flex-wrap items-center gap-3">
								{item.date ? (
									<span className="body-body-14-regular text-text-muted">{item.date}</span>
								) : null}

								{item.date && item.href ? (
									<span
										aria-hidden="true"
										className="h-[6px] w-[6px] rounded-full bg-border-strong"
									/>
								) : null}

								{item.href ? (
									<a
										href={item.href}
										target="_blank"
										rel="noreferrer"
										className="body-body-14-bold text-text-link hover:text-text-link-hover no-underline"
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
