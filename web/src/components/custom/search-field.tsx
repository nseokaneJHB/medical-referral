import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	onCommit: () => void;
	placeholder: string;
}

export const SearchField = ({
	value,
	onChange,
	onCommit,
	placeholder,
}: SearchFieldProps) => (
	<div className="ml-auto flex items-center gap-2">
		<Input
			value={value}
			placeholder={placeholder}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.key === "Enter") onCommit();
			}}
			className="h-10 max-w-sm text-base"
		/>
		<Button variant="outline" title="Search" onClick={onCommit}>
			<SearchIcon />
		</Button>
	</div>
);
