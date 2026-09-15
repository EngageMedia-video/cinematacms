/**
 * Whether the signed-in member may delete a given comment.
 *
 * The API sends `can_delete` per comment, so a viewer sees the control on the
 * comment they wrote even on someone else's media. The page-wide
 * `can.deleteComment` flag only covers a payload that predates the field.
 */
export function canDeleteComment(member, comment) {
	if (!member || member.is.anonymous) {
		return false;
	}
	if ('boolean' === typeof (comment && comment.can_delete)) {
		return comment.can_delete;
	}
	return true === member.can.deleteComment;
}
