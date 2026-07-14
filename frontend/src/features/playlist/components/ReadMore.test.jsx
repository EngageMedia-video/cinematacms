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

	it('renders nothing without text', () => {
		const { container } = render(<ReadMore id="empty" text="" />);

		expect(container).toBeEmptyDOMElement();
	});
});
