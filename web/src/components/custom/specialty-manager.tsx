import { useState } from "react";

import { PlusIcon, XIcon } from "lucide-react";

import type { SpecialtyRef } from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { SelectInput } from "@/components/custom/select-input";

interface SpecialtyLink {
	id: string;
	specialty: SpecialtyRef;
}

/**
 * Assigned-specialty chips (removable when `editable`) plus a searchable
 * picker to add one more — shared between the facility and user detail
 * pages, which need identical behavior modulo which assign/unassign
 * functions are wired in.
 */
export const SpecialtyManager = ({
	assigned,
	allSpecialties,
	editable,
	onAssign,
	onUnassign,
}: {
	assigned: SpecialtyLink[];
	allSpecialties: SpecialtyRef[];
	editable: boolean;
	onAssign: (specialtyId: string) => Promise<void>;
	onUnassign: (link: SpecialtyLink) => Promise<void>;
}) => {
	const [selected, setSelected] = useState<string | undefined>(undefined);
	const [assigning, setAssigning] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const assignedIds = new Set(assigned.map((link) => link.specialty.id));
	const availableItems = allSpecialties
		.filter((specialty) => !assignedIds.has(specialty.id))
		.map((specialty) => ({ value: specialty.id, label: specialty.name }));

	const handleAssign = async () => {
		if (!selected) return;
		setAssigning(true);
		try {
			await onAssign(selected);
			setSelected(undefined);
		} finally {
			setAssigning(false);
		}
	};

	const handleUnassign = async (link: SpecialtyLink) => {
		setRemovingId(link.id);
		try {
			await onUnassign(link);
		} finally {
			setRemovingId(null);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-2">
				{assigned.length === 0 && (
					<p className="text-muted-foreground text-sm">No specialties assigned.</p>
				)}
				{assigned.map((link) => (
					<Badge key={link.id} variant="secondary">
						{link.specialty.name}
						{editable && (
							<button
								type="button"
								title={`Remove ${link.specialty.name}`}
								disabled={removingId === link.id}
								onClick={() => handleUnassign(link)}
								className="hover:text-destructive"
							>
								<XIcon className="size-3" />
							</button>
						)}
					</Badge>
				))}
			</div>

			{editable && availableItems.length > 0 && (
				<div className="flex items-end gap-2">
					<SelectInput
						searchable
						placeholder="Select a specialty"
						items={availableItems}
						value={selected}
						onChange={setSelected}
						disabled={assigning}
						containerClassName="max-w-xs flex-1"
					/>
					<Button
						type="button"
						title="Add specialty"
						disabled={!selected || assigning}
						onClick={handleAssign}
					>
						{assigning ? <Spinner /> : <PlusIcon />}
						<span>Add</span>
					</Button>
				</div>
			)}
		</div>
	);
};
