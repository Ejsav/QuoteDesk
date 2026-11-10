export const USER_ROLES = ["owner", "admin", "agent"] as const;
export type UserRole = (typeof USER_ROLES)[number];
