import { render, screen } from '@testing-library/react';
import { ReadMore } from './ReadMore';
import usePlaylistUiStore from '../store/usePlaylistUiStore';

describe('ReadMore', () => {
	beforeEach(() => {
		usePlaylistUiStore.getState().resetPlaylistUi();
	});

	it('preserves paragraph breaks with whitespace-pre-line', () => {
		render(<ReadMore id="note" text={'First paragraph.\n\nSecond paragraph.'} />);

		const paragraph = document.getElementById('note');
		expect(paragraph).toHaveClass('whitespace-pre-line');
		expect(paragraph).toHaveTextContent('First paragraph.');
	});

	it('offers a READ MORE toggle only for long text', () => {
		const longText = 'word '.repeat(120).trim();
		render(<ReadMore id="long" text={longText} charBudget={100} />);

		expect(screen.getByRole('button', { name: 'READ MORE' })).toBeInTheDocument();
	});

	it('renders a URL as a safe anchor when linking is enabled', () => {
		render(<ReadMore id="note" text={'Screening at https://cinemata.org/watch.'} linkify />);

		const link = screen.getByRole('link', { name: 'https://cinemata.org/watch' });
		expect(link).toHaveAttribute('href', 'https://cinemata.org/watch');
		expect(link).toHaveAttribute('rel', 'nofollow noopener');
		expect(link).toHaveAttribute('target', '_blank');
		expect(document.getElementById('note')).toHaveTextContent('Screening at https://cinemata.org/watch.');
	});

	it('leaves a URL as plain text when linking is not enabled', () => {
		render(<ReadMore id="note" text={'Screening at https://cinemata.org/watch'} />);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	it('does not link markup or an unsupported scheme', () => {
		render(<ReadMore id="note" text={'<a href="javascript:alert(1)">x</a> javascript:alert(1)'} linkify />);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(document.getElementById('note')).toHaveTextContent('<a href="javascript:alert(1)">x</a>');
	});

	it('does not link a URL that truncation clipped', () => {
		const text = `Watch https://cinemata.org/watch/a-very-long-slug ${'word '.repeat(20).trim()}`;
		render(<ReadMore id="note" text={text} charBudget={20} linkify />);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'READ MORE' })).toBeInTheDocument();
	});

	it('renders nothing without text', () => {
		const { container } = render(<ReadMore id="empty" text="" />);

		expect(container).toBeEmptyDOMElement();
	});
});
