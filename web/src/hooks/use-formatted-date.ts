import { useEffect, useState } from "react";

import { formatDate } from "@referral-tracking/shared";

export const useFormattedDate = (
	date: string | null,
	options?: { includeTime?: boolean },
): string | null => {
	const [value, setValue] = useState<string | null>(null);

	useEffect(() => {
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		setValue(formatDate(date, { ...options, timeZone }));
	}, [date, options?.includeTime]);

	return value;
};
