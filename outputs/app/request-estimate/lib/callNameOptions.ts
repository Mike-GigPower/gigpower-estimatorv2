/**
 * Customer-facing Call Name options for the public request form.
 *
 * The `value` is the SmartStaff Call Name (matches REQUEST_UI_CALL_NAMES
 * in @/src/lib/types and is consumed by `roleForCallName` server-side).
 * The `label` is the plain-English version shown to customers.
 *
 * Grouped via <optgroup> in CallNameSelect to reduce cognitive load
 * in an 18-item dropdown.
 *
 * If REQUEST_UI_CALL_NAMES changes upstream, this file must be updated
 * to match — there's a runtime sanity check in CallNameSelect that
 * warns in dev if the two drift apart.
 */

export type CallNameOption = {
  label: string;   // What the customer sees
  value: string;   // SmartStaff Call Name — must match REQUEST_UI_CALL_NAMES
};

export type CallNameGroup = {
  label: string;
  options: CallNameOption[];
};

export const CALL_NAME_GROUPS: CallNameGroup[] = [
  {
    label: "Setup & pack-down",
    options: [
      { label: "Setup / bump-in crew", value: "Load In" },
      { label: "Pack-down / bump-out crew", value: "Load Out" },
      { label: "Site crew", value: "Site" },
      { label: "Utility / general assistant", value: "Utility" },
      { label: "General hand", value: "General" },
    ],
  },
  {
    label: "Audio, lighting & video",
    options: [
      { label: "Lighting technician (LX)", value: "LX" },
      { label: "Audio technician (SX)", value: "SX" },
      { label: "Video / AV technician (VX)", value: "VX" },
      { label: "Followspot operator — front of house", value: "FOH Spot" },
      { label: "Followspot operator — truss", value: "Truss Spot" },
    ],
  },
  {
    label: "Show running",
    options: [
      { label: "Show operator (show call)", value: "Show Call" },
      { label: "Backline / instrument tech", value: "Backline" },
      { label: "Wardrobe assistant", value: "Wardrobe" },
      { label: "Crew supervisor (crew boss)", value: "Crew Boss" },
    ],
  },
  {
    label: "Specialist & certified",
    options: [
      { label: "Rigger / steel work", value: "Steel" },
      { label: "Forklift operator", value: "Fork" },
      { label: "Truck driver", value: "Truck" },
      { label: "EWP / scissor lift operator", value: "EWP" },
    ],
  },
];

/** Flat list of all values, used for dev-time validation against REQUEST_UI_CALL_NAMES */
export const CALL_NAME_VALUES: string[] = CALL_NAME_GROUPS.flatMap((g) =>
  g.options.map((o) => o.value)
);
