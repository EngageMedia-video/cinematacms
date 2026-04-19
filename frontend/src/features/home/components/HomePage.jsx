import '../../static/css/tailwind.css';

export function HomePage() {
	return (
		<div data-modern-track className="bg-surface-body min-h-screen">
			<main className="mx-auto max-w-7xl px-4 py-16">
				<h1 className="font-kq-display text-kq-h1 leading-kq-h1 tracking-kq-h1 font-kq-bold text-content-body">
					Cinemata
				</h1>
				<p className="font-kq-body text-kq-body-18 leading-kq-body-18 font-kq-regular text-content-body mt-4">
					A platform for social and environmental films about the Asia-Pacific.
				</p>
			</main>
		</div>
	);
}
