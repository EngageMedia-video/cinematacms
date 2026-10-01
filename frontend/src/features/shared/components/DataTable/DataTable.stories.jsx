import { DataTable } from './DataTable';

export default {
	title: 'Components/DataTable',
	component: DataTable,
	args: {
		caption: 'Film figures',
		responsive: true,
		rowKey: (row) => row.id,
		columns: [
			{ key: 'title', label: 'Film', rowHeader: true, render: (row) => row.title },
			{ key: 'plays', label: 'Plays', align: 'right', render: (row) => row.plays },
		],
		rows: [
			{ id: 1, title: 'A film from our community', plays: 42 },
			{ id: 2, title: 'Another story', plays: 16 },
		],
	},
};
export const Responsive = {};
export const Scrollable = {
	args: {
		responsive: false,
		stickyHeader: true,
		className: 'max-h-72',
		rows: Array.from({ length: 20 }, (_, id) => ({ id, title: `Film ${id + 1}`, plays: id * 3 })),
	},
};
