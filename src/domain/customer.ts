export const CONTACT_METHODS = ["phone", "text", "email"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone call",
  text: "Text message",
  email: "Email",
};

/** Ways a contact can be logged on a lead's timeline. Logged by staff — QuoteDesk sends nothing itself. */
export const CONTACT_CHANNELS = ["call", "email", "text", "meeting"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  call: "Call",
  email: "Email",
  text: "Text",
  meeting: "Meeting",
};

export const CONTACT_DIRECTIONS = ["outbound", "inbound"] as const;
export type ContactDirection = (typeof CONTACT_DIRECTIONS)[number];
