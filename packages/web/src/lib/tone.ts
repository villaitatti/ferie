/**
 * Absence states, balances and reconciliation cases all speak in the same small set of colours.
 * Naming them once keeps the mapping in one place and out of the pages.
 *
 * The button maps repeat the hover state deliberately: `tailwind-merge` only drops a `hover:bg-*`
 * class when the override carries the same modifier, so a tone without one would fall back to the
 * primary green on hover.
 */
export type Tone = "green" | "yellow" | "orange" | "red" | "blue" | "violet" | "gray" | "primary";

export const toneSoft: Record<Tone, string> = {
  green: "bg-tone-green-soft text-tone-green",
  yellow: "bg-tone-yellow-soft text-tone-yellow",
  orange: "bg-tone-orange-soft text-tone-orange",
  red: "bg-tone-red-soft text-tone-red",
  blue: "bg-tone-blue-soft text-tone-blue",
  violet: "bg-tone-violet-soft text-tone-violet",
  gray: "bg-tone-gray-soft text-tone-gray",
  primary: "bg-forest-50 text-forest-800",
};

/** `toneSoft` for a control: same fill, with a hover step that stays inside the tone. */
export const toneSoftButton: Record<Tone, string> = {
  green: "bg-tone-green-soft text-tone-green hover:bg-tone-green/15",
  yellow: "bg-tone-yellow-soft text-tone-yellow hover:bg-tone-yellow/15",
  orange: "bg-tone-orange-soft text-tone-orange hover:bg-tone-orange/15",
  red: "bg-tone-red-soft text-tone-red hover:bg-tone-red/15",
  blue: "bg-tone-blue-soft text-tone-blue hover:bg-tone-blue/15",
  violet: "bg-tone-violet-soft text-tone-violet hover:bg-tone-violet/15",
  gray: "bg-tone-gray-soft text-tone-gray hover:bg-tone-gray/15",
  primary: "bg-forest-50 text-forest-800 hover:bg-forest-100",
};

export const toneSolid: Record<Tone, string> = {
  green: "bg-tone-green text-white hover:bg-tone-green/90",
  yellow: "bg-tone-yellow text-white hover:bg-tone-yellow/90",
  orange: "bg-tone-orange text-white hover:bg-tone-orange/90",
  red: "bg-tone-red text-white hover:bg-tone-red/90",
  blue: "bg-tone-blue text-white hover:bg-tone-blue/90",
  violet: "bg-tone-violet text-white hover:bg-tone-violet/90",
  gray: "bg-tone-gray text-white hover:bg-tone-gray/90",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
};

export const toneText: Record<Tone, string> = {
  green: "text-tone-green",
  yellow: "text-tone-yellow",
  orange: "text-tone-orange",
  red: "text-tone-red",
  blue: "text-tone-blue",
  violet: "text-tone-violet",
  gray: "text-muted-foreground",
  primary: "text-primary",
};

export const toneBorder: Record<Tone, string> = {
  green: "border-tone-green/30",
  yellow: "border-tone-yellow/30",
  orange: "border-tone-orange/30",
  red: "border-tone-red/30",
  blue: "border-tone-blue/30",
  violet: "border-tone-violet/30",
  gray: "border-border",
  primary: "border-primary/30",
};
