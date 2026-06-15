import { Text } from '../../../shared/components';
import { EditorialPolicyNotice } from '../../../upload-shared';
import useBulkUploadStore from '../../useBulkUploadStore';
import { SubStepNav } from './SubStepNav';
import { FileCard } from './FileCard';

export function EnterDetails({ files, options, validationErrors = {}, onClearErrors }) {
	const subStep = useBulkUploadStore((state) => state.subStep);
	const setSubStep = useBulkUploadStore((state) => state.setSubStep);

	return (
		<div>
			<Text as="h1" variant="h5" className="text-text-strong">
				Enter Details
			</Text>
			<EditorialPolicyNotice className="mt-2" />

			<div className="mt-6">
				<SubStepNav value={subStep} onChange={setSubStep} />
			</div>

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
