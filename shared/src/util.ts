/**
 * Converts a string to Title Case, treating underscores, hyphens, and
 * whitespace as word boundaries and collapsing them into single spaces.
 *
 * @example
 * stringToTitleCase("under_review") // "Under Review"
 * stringToTitleCase("east-africa")  // "East Africa"
 * stringToTitleCase(undefined)      // ""
 *
 * @param str - The string to convert. Falsy values return an empty string.
 * @returns The title-cased string, or "" if no input was provided.
 */
export const stringToTitleCase = (str?: string): string => {
	if (!str) return "";

	return str
		.toLowerCase()
		.replace(/(^|[_\s-])\S/g, (match) => match.toUpperCase())
		.replace(/[_\s-]+/g, " ");
};

/**
 * Formats an ISO date string into a locale-aware (en-ZA) display string,
 * optionally including the time and a specific timezone.
 *
 * @example
 * formatDate("2026-07-05T10:00:00Z") // "5 Jul 2026"
 * formatDate("2026-07-05T10:00:00Z", { includeTime: true }) // "5 Jul 2026, 10:00:00 AM"
 * formatDate(null) // "N/A"
 *
 * @param date - An ISO date string, or null/undefined to indicate no value.
 * @param options.includeTime - When true, appends hour/minute/second to the output.
 * @param options.timeZone - An IANA timezone identifier to format the date in.
 * @returns A formatted date string, or "N/A" if no date was provided.
 */
export const formatDate = (
	date: string | null,
	options?: { includeTime?: boolean; timeZone?: string },
): string => {
	if (!date) return "N/A";

	const { includeTime = false, timeZone } = options ?? {};

	return new Intl.DateTimeFormat("en-ZA", {
		year: "numeric",
		month: "short",
		day: "numeric",
		// Conditionally add time and timezone properties
		...(timeZone && { timeZone }),
		...(includeTime && {
			hour12: true,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}),
	}).format(new Date(date));
};

/**
 * Converts an ISO date string into a natural-language relative time
 * description (e.g. "yesterday", "in 3 hours"), automatically picking the
 * largest sensible unit for the difference from now.
 *
 * @example
 * getRelativeTime(oneHourAgoIso)   // "1 hour ago"
 * getRelativeTime(tomorrowIso)     // "tomorrow"
 * getRelativeTime(null)            // "N/A"
 *
 * @param date - An ISO date string, or null/undefined to indicate no value.
 * @returns A relative time phrase relative to the current moment, or "N/A"
 * if no date was provided.
 */
export const getRelativeTime = (date: string) => {
	if (!date.trim()) return "N/A";

	const diffInSeconds =
		(new Date(date).getTime() - new Date().getTime()) / 1000;

	// Create formatter with 'auto' for natural language (e.g., "yesterday" instead of "1 day ago")
	const rtf = new Intl.RelativeTimeFormat("en", {
		numeric: "auto",
		style: "long",
	});

	// Define thresholds for each unit
	const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
		{ unit: "year", seconds: 31536000 },
		{ unit: "month", seconds: 2592000 },
		{ unit: "week", seconds: 604800 },
		{ unit: "day", seconds: 86400 },
		{ unit: "hour", seconds: 3600 },
		{ unit: "minute", seconds: 60 },
		{ unit: "second", seconds: 1 },
	];

	// Find the largest appropriate unit
	for (const { unit, seconds } of units) {
		const amount = Math.round(diffInSeconds / seconds);
		// Use this unit if the absolute value is >= 1, or if we are down to seconds
		if (Math.abs(amount) >= 1 || unit === "second") {
			return rtf.format(amount, unit);
		}
	}

	return rtf.format(0, "second"); // Fallback for "now"
};

/**
 * Extracts the literal names of all `:param` segments from a route pattern
 * string, as a union of string literal types.
 *
 * @example
 * ExtractParams<"/sessions/revoke/:id"> // "id"
 * ExtractParams<"/user/:userId/story/:storyId"> // "userId" | "storyId"
 */
type ExtractParams<T extends string> =
	T extends `${string}:${infer Param}/${infer Rest}`
		? Param | ExtractParams<`/${Rest}`>
		: T extends `${string}:${infer Param}`
			? Param
			: never;

/**
 * Builds a concrete URL from a Fastify-style route pattern by substituting
 * each `:param` segment with its corresponding value. The required keys of
 * `params` are inferred at compile time from the pattern itself, so passing
 * the wrong or missing keys is a type error.
 *
 * @example
 * buildUrlWithParams(API_PATHS.SESSIONS_REVOKE_REQUEST, { id: sessionId });
 * // "/sessions/revoke/:id" -> "/sessions/revoke/abc-123"
 *
 * buildUrlWithParams("/user/:userId/story/:storyId", { userId, storyId });
 * // "/user/:userId/story/:storyId" -> "/user/u1/story/s1"
 *
 * @param pattern - A route pattern containing one or more unique `:param` segments.
 * @param params - A map of param name to value for every `:param` in the pattern.
 * @returns The pattern with all `:param` placeholders replaced by their values.
 */
export const buildUrlWithParams = <T extends string>(
	pattern: T,
	params: Record<ExtractParams<T>, string>,
): string => {
	let url: string = pattern;

	for (const [key, value] of Object.entries(params)) {
		url = url.replace(`:${key}`, value as string);
	}

	return url;
};
