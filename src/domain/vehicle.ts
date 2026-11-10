/**
 * Vehicle categories are shared vocabulary between what a customer asks for
 * (lead preference) and what an operator runs (fleet records), so future
 * matching and offer comparison compare like with like.
 */

export const VEHICLE_CATEGORIES = [
  "sedan",
  "suv",
  "sprinter",
  "stretch_limo",
  "suv_limo",
  "party_bus",
  "mini_coach",
  "motor_coach",
  "trolley",
] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_CATEGORY_META: Record<
  VehicleCategory,
  { label: string; plural: string; typicalCapacity: readonly [number, number] }
> = {
  sedan: { label: "Luxury sedan", plural: "Luxury sedans", typicalCapacity: [1, 3] },
  suv: { label: "Luxury SUV", plural: "Luxury SUVs", typicalCapacity: [1, 6] },
  sprinter: { label: "Sprinter van", plural: "Sprinter vans", typicalCapacity: [8, 14] },
  stretch_limo: { label: "Stretch limousine", plural: "Stretch limousines", typicalCapacity: [6, 10] },
  suv_limo: { label: "SUV limousine", plural: "SUV limousines", typicalCapacity: [12, 20] },
  party_bus: { label: "Party bus", plural: "Party buses", typicalCapacity: [20, 45] },
  mini_coach: { label: "Mini coach", plural: "Mini coaches", typicalCapacity: [24, 38] },
  motor_coach: { label: "Motor coach", plural: "Motor coaches", typicalCapacity: [45, 57] },
  trolley: { label: "Trolley", plural: "Trolleys", typicalCapacity: [20, 36] },
};

/** A lead may record "no preference" — distinct from "not discussed yet" (null). */
export const VEHICLE_PREFERENCES = [...VEHICLE_CATEGORIES, "no_preference"] as const;
export type VehiclePreference = (typeof VEHICLE_PREFERENCES)[number];

export function vehiclePreferenceLabel(value: VehiclePreference): string {
  return value === "no_preference" ? "No preference" : VEHICLE_CATEGORY_META[value].label;
}

export const VEHICLE_AMENITIES = [
  "wifi",
  "restroom",
  "bar",
  "sound_system",
  "lighting",
  "screens",
  "usb_power",
  "luggage",
  "wheelchair",
] as const;
export type VehicleAmenity = (typeof VEHICLE_AMENITIES)[number];

export const VEHICLE_AMENITY_LABELS: Record<VehicleAmenity, string> = {
  wifi: "Wi-Fi",
  restroom: "Restroom",
  bar: "Bar area",
  sound_system: "Premium sound",
  lighting: "Mood lighting",
  screens: "TV screens",
  usb_power: "USB / power",
  luggage: "Luggage bays",
  wheelchair: "Wheelchair accessible",
};
