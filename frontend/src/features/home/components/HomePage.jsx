import '../../../static/css/tailwind.css';

export function HomePage() {
	return (
		<div
			data-modern-track
			className="min-h-screen bg-linear-to-b from-cinemata-sandy-shore-50 via-cinemata-coral-reef-light-50 to-cinemata-white text-content-body"
		>
			<main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 md:px-6 md:py-14">
				<section className="overflow-hidden rounded-[32px] bg-cinemata-pacific-deep-700 text-cinemata-white shadow-[0_24px_80px_rgba(1,28,52,0.24)]">
					<div className="grid gap-8 px-6 py-8 md:grid-cols-[minmax(0,1fr)_320px] md:px-10 md:py-10">
						<div className="max-w-3xl">
							<span className="caption-caption-10-semibold inline-flex rounded-full bg-cinemata-coral-reef-300 px-3 py-1 uppercase tracking-[0.18em] text-cinemata-pacific-deep-900">
								Revamp preview
							</span>
							<h1 className="title-title-72-medium mt-5 max-w-2xl text-cinemata-white max-md:text-[48px] max-md:leading-[58px]">
								Cinemata's shared revamp palette is now available in the modern track.
							</h1>
							<p className="body-body-18-regular mt-4 max-w-2xl text-cinemata-neutral-100">
								The home pilot can use the new color system immediately, while legacy pages keep their
								existing rendering and continue reading the same server-side theme variables.
							</p>
							<div className="mt-6 flex flex-wrap gap-3">
								<a
									href="/latest"
									className="body-body-16-bold rounded-full bg-cinemata-sunset-horizon-300 px-5 py-3 text-cinemata-white no-underline transition hover:bg-cinemata-sunset-horizon-500"
								>
									Explore latest films
								</a>
								<a
									href="/?ui=revamp"
									className="body-body-16-bold rounded-full border border-cinemata-strait-blue-200 bg-cinemata-white/8 px-5 py-3 text-cinemata-white no-underline transition hover:bg-cinemata-white/14"
								>
									Preview revamp mode
								</a>
							</div>
						</div>

						<div className="grid gap-4 rounded-[28px] bg-cinemata-white/8 p-5 backdrop-blur-sm">
							<div className="rounded-3xl bg-cinemata-white p-5 text-cinemata-pacific-deep-900">
								<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-strait-blue-500">
									Primary action
								</p>
								<p className="heading-h5-24-bold mt-2">Strait Blue 500</p>
								<p className="body-body-14-regular mt-1 text-cinemata-neutral-600">
									Buttons, player accents, active UI.
								</p>
							</div>
							<div className="rounded-3xl bg-cinemata-coral-reef-300 p-5 text-cinemata-pacific-deep-900">
								<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-700">
									Support surface
								</p>
								<p className="heading-h5-24-bold mt-2">Coral Reef 300</p>
								<p className="body-body-14-regular mt-1 text-cinemata-pacific-deep-700">
									Soft emphasis and ambient fills.
								</p>
							</div>
						</div>
					</div>
				</section>

				<section className="rounded-[32px] border border-cinemata-neutral-200 bg-cinemata-white p-6 shadow-[0_12px_40px_rgba(17,24,39,0.06)] md:p-8">
					<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-strait-blue-500">
								Type system preview
							</p>
							<h2 className="heading-h2-48-bold mt-3 text-cinemata-pacific-deep-700 max-md:text-[36px] max-md:leading-[44px]">
								New text styles, live on the revamped home page
							</h2>
						</div>
						<p className="body-body-14-regular max-w-md text-cinemata-neutral-600">
							These are the exact global classes now available to legacy templates and revamp components.
						</p>
					</div>

					<div className="mt-8 grid gap-4 md:grid-cols-2">
						<div className="rounded-[24px] bg-cinemata-sandy-shore-50 p-6">
							<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-sunset-horizon-700">
								Display
							</p>
							<p className="title-title-56-bold mt-3 text-cinemata-pacific-deep-700 max-md:text-[42px] max-md:leading-[50px]">
								Stories that move across borders
							</p>
							<p className="body-body-16-regular mt-4 text-cinemata-neutral-600">
								Using{' '}
								<code className="rounded bg-cinemata-white px-1 py-0.5">.title-title-56-bold</code>
							</p>
						</div>

						<div className="rounded-[24px] bg-cinemata-coral-reef-light-50 p-6">
							<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-coral-reef-700">
								Headings
							</p>
							<p className="heading-h3-40-medium mt-3 text-cinemata-pacific-deep-700 max-md:text-[32px] max-md:leading-[38px]">
								Curated films, campaigns, and community knowledge
							</p>
							<p className="body-body-16-regular mt-4 text-cinemata-pacific-deep-500">
								Using{' '}
								<code className="rounded bg-cinemata-white px-1 py-0.5">.heading-h3-40-medium</code>
							</p>
						</div>

						<div className="rounded-[24px] bg-cinemata-white p-6 ring-1 ring-cinemata-neutral-200">
							<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-500">
								Body 18
							</p>
							<p className="body-body-18-medium mt-3 text-cinemata-pacific-deep-700">
								The redesigned UI pairs Barlow Semi Condensed for titles with Inter for readable
								long-form copy and product messaging.
							</p>
						</div>

						<div className="rounded-[24px] bg-cinemata-pacific-deep-700 p-6 text-cinemata-white">
							<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-coral-reef-300">
								Body scale
							</p>
							<div className="mt-3 space-y-2">
								<p className="body-body-16-bold">Body 16 bold for UI emphasis</p>
								<p className="body-body-14-regular text-cinemata-neutral-100">
									Body 14 regular for support text and metadata blocks.
								</p>
								<p className="body-body-12-medium text-cinemata-neutral-200">
									Body 12 medium for dense UI labels, statuses, and table support text.
								</p>
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-3">
					<div className="rounded-[28px] border border-cinemata-neutral-200 bg-cinemata-white p-6 shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
						<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-500">
							Migration safe
						</p>
						<h2 className="heading-h6-20-bold mt-3 text-cinemata-pacific-deep-700">Legacy stays intact</h2>
						<p className="body-body-14-regular mt-3 text-cinemata-neutral-600">
							The palette is exposed through shared CSS variables and modern-track Tailwind tokens, so
							pages not on the revamp allowlist keep their current UI.
						</p>
					</div>
					<div className="rounded-[28px] border border-cinemata-neutral-200 bg-cinemata-coral-reef-light-50 p-6 shadow-[0_12px_40px_rgba(0,73,53,0.08)]">
						<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-coral-reef-700">
							Revamp tokens
						</p>
						<h2 className="heading-h6-20-bold mt-3 text-cinemata-pacific-deep-700">
							Tailwind-ready colors
						</h2>
						<p className="body-body-14-regular mt-3 text-cinemata-pacific-deep-500">
							Use utilities like{' '}
							<code className="rounded bg-cinemata-white px-1 py-0.5">bg-cinemata-strait-blue-500</code>{' '}
							or <code className="rounded bg-cinemata-white px-1 py-0.5">text-cinemata-neutral-600</code>{' '}
							in feature components.
						</p>
					</div>
					<div className="rounded-[28px] border border-cinemata-neutral-200 bg-cinemata-sandy-shore-50 p-6 shadow-[0_12px_40px_rgba(131,62,11,0.08)]">
						<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-sunset-horizon-700">
							Shared language
						</p>
						<h2 className="heading-h6-20-bold mt-3 text-cinemata-pacific-deep-700">One product feel</h2>
						<p className="body-body-14-regular mt-3 text-cinemata-neutral-600">
							Accent orange, deep blue, coral reef, amber, neutrals, success, and error scales are now
							ready for incremental rollout across revamp pages.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}
