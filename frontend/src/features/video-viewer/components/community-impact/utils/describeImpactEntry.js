function join(parts, separator = ' · ') {
	return parts.filter(Boolean).join(separator);
}

function by(prefix, name) {
	return name ? `${prefix} ${name}` : '';
}

/**
 * One-line context for a list entry, built from the fields its category's form
 * collects. Legacy entries carry none of them and get an empty summary.
 */
export function describeImpactEntry(entry = {}) {
	switch (entry.category) {
		case 'screening':
			return join([
				entry.is_online ? 'Online' : join([entry.city, entry.country_label], ', '),
				by('Organised by', entry.organiser),
			]);
		case 'article':
			return join([by('By', entry.creator), entry.publication]);
		case 'referenced':
			return join([entry.medium_label, by('Made by', entry.creator)]);
		case 'award':
			return join([entry.award_result_label, by('Given by', entry.organiser)]);
		case 'teaching':
			return join([by('Led by', entry.creator), entry.organiser]);
		default:
			return '';
	}
}
