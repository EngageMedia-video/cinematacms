import { useRef } from 'react';

import { PopupContent } from '../PopupContent';
import { PopupTrigger } from '../PopupTrigger';

export function usePopup() {
	const popupContentRef = useRef(null);

	return [popupContentRef, PopupContent, PopupTrigger];
}
