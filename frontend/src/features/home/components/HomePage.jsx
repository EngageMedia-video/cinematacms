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
							<span className="inline-flex rounded-full bg-cinemata-coral-reef-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-900">
								Revamp preview
							</span>
							<h1 className="mt-5 max-w-2xl font-heading text-4xl leading-tight md:text-6xl">
								Cinemata's shared revamp palette is now available in the modern track.
							</h1>
							<p className="mt-4 max-w-2xl text-base leading-7 text-cinemata-neutral-100 md:text-lg">
								The home pilot can use the new color system immediately, while legacy pages keep their
								existing rendering and continue reading the same server-side theme variables.
							</p>
							<div className="mt-6 flex flex-wrap gap-3">
								<a
									href="/latest"
									className="rounded-full bg-cinemata-sunset-horizon-300 px-5 py-3 text-sm font-semibold text-cinemata-white no-underline transition hover:bg-cinemata-sunset-horizon-500"
								>
									Explore latest films
								</a>
								<a
									href="/?ui=revamp"
									className="rounded-full border border-cinemata-strait-blue-200 bg-cinemata-white/8 px-5 py-3 text-sm font-semibold text-cinemata-white no-underline transition hover:bg-cinemata-white/14"
								>
									Preview revamp mode
								</a>
							</div>
						</div>

						<div className="grid gap-4 rounded-[28px] bg-cinemata-white/8 p-5 backdrop-blur-sm">
							<div className="rounded-3xl bg-cinemata-white p-5 text-cinemata-pacific-deep-900">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cinemata-strait-blue-500">
									Primary action
								</p>
								<p className="mt-2 text-2xl font-semibold">Strait Blue 500</p>
								<p className="mt-1 text-sm text-cinemata-neutral-600">Buttons, player accents, active UI.</p>
							</div>
							<div className="rounded-3xl bg-cinemata-coral-reef-300 p-5 text-cinemata-pacific-deep-900">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-700">
									Support surface
								</p>
								<p className="mt-2 text-2xl font-semibold">Coral Reef 300</p>
								<p className="mt-1 text-sm text-cinemata-pacific-deep-700">Soft emphasis and ambient fills.</p>
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-3">
					<div className="rounded-[28px] border border-cinemata-neutral-200 bg-cinemata-white p-6 shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-500">
							Migration safe
						</p>
						<h2 className="mt-3 text-xl font-semibold text-cinemata-pacific-deep-700">Legacy stays intact</h2>
						<p className="mt-3 text-sm leading-6 text-cinemata-neutral-600">
							The palette is exposed through shared CSS variables and modern-track Tailwind tokens, so pages
							not on the revamp allowlist keep their current UI.
						</p>
					</div>
					<div className="rounded-[28px] border border-cinemata-neutral-200 bg-cinemata-coral-reef-light-50 p-6 shadow-[0_12px_40px_rgba(0,73,53,0.08)]">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cinemata-coral-reef-700">
							Revamp tokens
						</p>
						<h2 className="mt-3 text-xl font-semibold text-cinemata-pacific-deep-700">Tailwind-ready colors</h2>
						<p className="mt-3 text-sm leading-6 text-cinemata-pacific-deep-500">
							Use utilities like <code className="rounded bg-cinemata-white px-1 py-0.5">bg-cinemata-strait-blue-500</code>{' '}
							or <code className="rounded bg-cinemata-white px-1 py-0.5">text-cinemata-neutral-600</code> in
							feature components.
						</p>
					</div>
					<div className="rounded-[28px] border border-cinemata-neutral-200 bg-cinemata-sandy-shore-50 p-6 shadow-[0_12px_40px_rgba(131,62,11,0.08)]">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cinemata-sunset-horizon-700">
							Shared language
						</p>
						<h2 className="mt-3 text-xl font-semibold text-cinemata-pacific-deep-700">One product feel</h2>
						<p className="mt-3 text-sm leading-6 text-cinemata-neutral-600">
							Accent orange, deep blue, coral reef, amber, neutrals, success, and error scales are now ready
							for incremental rollout across revamp pages.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}
