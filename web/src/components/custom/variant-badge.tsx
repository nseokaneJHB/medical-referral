import type { VariantProps } from "class-variance-authority";

import {
	ROLES,
	PRIORITY,
	USER_STATUS,
	FACILITY_STATUS,
	REFERRAL_STATUS,
	stringToTitleCase,
} from "@referral-tracking/shared";

import { Badge, type badgeVariants } from "@/components/ui/badge";

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const USER_STATUS_VARIANT: Record<string, Variant> = {
	[USER_STATUS.PENDING]: "default",
	[USER_STATUS.ACTIVE]: "success",
	[USER_STATUS.REJECTED]: "error",
	[USER_STATUS.DISABLED]: "locked",
	[USER_STATUS.FLAGGED]: "warning",
	[USER_STATUS.DEPARTED]: "default",
};

const ROLE_VARIANT: Record<string, Variant> = {
	[ROLES.NURSE]: "info",
	[ROLES.DOCTOR]: "outline",
	[ROLES.MANAGER]: "suspended",
	[ROLES.ADMINISTRATOR]: "secondary",
};

const FACILITY_STATUS_VARIANT: Record<string, Variant> = {
	[FACILITY_STATUS.PENDING]: "default",
	[FACILITY_STATUS.APPROVED]: "success",
	[FACILITY_STATUS.REJECTED]: "error",
	[FACILITY_STATUS.FLAGGED]: "warning",
	[FACILITY_STATUS.SUSPENDED]: "error",
};

const PRIORITY_VARIANT: Record<string, Variant> = {
	[PRIORITY.LOW]: "default",
	[PRIORITY.MEDIUM]: "info",
	[PRIORITY.HIGH]: "warning",
	[PRIORITY.URGENT]: "error",
};

const REFERRAL_STATUS_VARIANT: Record<string, Variant> = {
	[REFERRAL_STATUS.PENDING]: "default",
	[REFERRAL_STATUS.ACCEPTED]: "info",
	[REFERRAL_STATUS.IN_PROGRESS]: "info",
	[REFERRAL_STATUS.ON_HOLD]: "warning",
	[REFERRAL_STATUS.COMPLETED]: "success",
	[REFERRAL_STATUS.REJECTED]: "error",
	[REFERRAL_STATUS.CANCELED]: "error",
};

const VARIANT_MAPS = {
	role: ROLE_VARIANT,
	priority: PRIORITY_VARIANT,
	userStatus: USER_STATUS_VARIANT,
	facilityStatus: FACILITY_STATUS_VARIANT,
	referralStatus: REFERRAL_STATUS_VARIANT,
} as const;

export type VariantBadgeType = keyof typeof VARIANT_MAPS;

interface VariantBadgeProps {
	value: string;
	type: VariantBadgeType;
}

export const VariantBadge = ({ value, type }: VariantBadgeProps) => (
	<Badge variant={VARIANT_MAPS[type][value]}>{stringToTitleCase(value)}</Badge>
);
