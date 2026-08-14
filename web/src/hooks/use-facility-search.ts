import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { facilitiesRequest } from "@/api/facilities";
import { QUERY_KEYS } from "@/api/constant";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface UseFacilitySearchOptions {
	enabled?: boolean;
	excludeId?: string;
	status?: string;
}

// Hybrid: only fires once the caller has typed something — no eager
// page:1/limit:100 fetch of every facility up front.
export const useFacilitySearch = ({
	enabled = true,
	excludeId,
	status,
}: UseFacilitySearchOptions = {}) => {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const { data, isFetching } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITIES, "picker", status, debouncedSearch],
		queryFn: () =>
			facilitiesRequest({
				data: { search: debouncedSearch, status, page: "1", limit: "20" },
			}),
		enabled: enabled && debouncedSearch.length > 0,
	});

	const items = (data?.data ?? [])
		.filter((facility) => facility.id !== excludeId)
		.map((facility) => ({ value: facility.id, label: facility.name }));

	return { search, setSearch, items, loading: isFetching };
};
