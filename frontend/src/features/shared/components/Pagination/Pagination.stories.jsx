import { Pagination } from './Pagination';

export default {
	title: 'Components/Pagination',
	component: Pagination,
	args: { page: 2, totalPages: 5, previousHref: '?page=1', nextHref: '?page=3' },
};
export const Default = {};
export const FirstPage = { args: { page: 1, previousHref: undefined, nextHref: '?page=2' } };
export const LastPage = { args: { page: 5, previousHref: '?page=4', nextHref: undefined } };
