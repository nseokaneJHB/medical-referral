import { XIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	onCommit: () => void;
	onClear: () => void;
	placeholder: string;
}

export const SearchField = ({
	value,
	onChange,
	onCommit,
	onClear,
	placeholder,
}: SearchFieldProps) => (
	<div className="ml-auto flex items-center gap-2">
		<div className="relative max-w-sm">
			<Input
				value={value}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") onCommit();
				}}
				className="h-10 pr-8 text-base"
			/>
			{value && (
				<button
					type="button"
					title="Clear search"
					onClick={onClear}
					className="text-muted-foreground hover:text-destructive absolute top-1/2 right-2 -translate-y-1/2"
				>
					<XIcon className="h-4 w-4" />
				</button>
			)}
		</div>
		<Button variant="outline" title="Search" onClick={onCommit}>
			<SearchIcon />
		</Button>
	</div>
);
