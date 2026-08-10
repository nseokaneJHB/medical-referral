import { EVENT_NAMES, LEVELS } from "../lib/constant";

export type Result<TData, TError = Error> = [TData, null] | [null, TError];

export type EventName = keyof typeof EVENT_NAMES;

export type CustomLevels = keyof typeof LEVELS;
