import useBulkUploadStore from '../../useBulkUploadStore';
import { SubStepNav } from './SubStepNav';
import { FileCard } from './FileCard';

// The "Enter Details" title + description is rendered by the page header (host),
// so this component starts straight at the sub-step nav.
export function EnterDetails({ files, options, validationErrors = {}, incompleteSubSteps, onClearErrors }) {
	const subStep = useBulkUploadStore((state) => state.subStep);
	const setSubStep = useBulkUploadStore((state) => state.setSubStep);

	return (
		<div>
			<SubStepNav value={subStep} onChange={setSubStep} incompleteSubSteps={incompleteSubSteps} />

			<div className="mt-6 flex flex-col gap-6">
				{files.map((file) => (
					<FileCard
						key={file.id}
						file={file}
						subStep={subStep}
						options={options}
						errors={validationErrors[file.id] || {}}
						onClearErrors={onClearErrors}
					/>
				))}
			</div>
		</div>
	);
}
