import { render, screen, within } from '@testing-library/react';
import { DataTable } from './DataTable';

it('keeps row headings and values in both table and responsive detail layouts', () => {
	render(
		<DataTable
			caption="Film figures"
			responsive
			rowKey={(row) => row.id}
			rows={[{ id: 1, title: 'First film', plays: 42 }]}
			columns={[
				{ key: 'title', label: 'Film', rowHeader: true, render: (row) => row.title },
				{ key: 'plays', label: 'Plays', align: 'right', render: (row) => row.plays },
			]}
		/>
	);
	const table = within(screen.getByRole('table', { name: 'Film figures' }));
	expect(table.getByRole('rowheader', { name: 'First film' })).toHaveAttribute('scope', 'row');
	expect(table.getByRole('columnheader', { name: 'Plays' })).toHaveAttribute('scope', 'col');
	expect(table.getByRole('cell', { name: '42' })).toBeInTheDocument();
	const card = within(screen.getByRole('article'));
	expect(card.getByText('First film')).toBeInTheDocument();
	expect(card.getByRole('term')).toHaveTextContent('Plays');
	expect(card.getByRole('definition')).toHaveTextContent('42');
});
