// Building catalogue — single source of truth for fee config, capacity,
// and physical hierarchy of every building the PG operates.
//
// Adding a new building? Append to BUILDINGS and run a new SQL seed.
// Capacity numbers here are the *planned* capacity, not the live count;
// the live count comes from `units.occupied_count` in the DB.

export type BuildingCode =
  | 'chalapathi-main'
  | 'stanza'
  | 'villas'
  | 'siddha-middle';

export interface FeeConfig {
  yearly_fee: number;
  electricity_fee: number;       // 0 if the building has no electricity charge
  non_refundable_fee: number;    // advance / non-refundable component
  semester_split: boolean;       // true => yearly fee can be split into 2 semesters
}

// What the physical hierarchy of a building looks like.
// Every building eventually leads to *beds* — but the path varies.
//
//   Chalapathi:    building → flat → bed   (6 beds per flat)
//   Stanza:        building → floor → flat → room → bed   (3 beds per room)
//   Villas:        building → villa → bed   (15 beds per villa)
//   Siddha:        TBD — admin configures at runtime
export interface HierarchyConfig {
  has_floors: boolean;
  has_flats: boolean;
  has_villas: boolean;
  has_rooms_in_flats: boolean;
  // Default beds-per-leaf-unit when the seed runs.
  beds_per_unit: number;
}

export interface BuildingConfig {
  code: BuildingCode;
  name: string;
  short_name: string;
  fee: FeeConfig;
  hierarchy: HierarchyConfig;
  planned_capacity: number;
  // Seed parameters (used by the SQL seed). Optional for buildings
  // whose layout is admin-configured.
  seed?: {
    floors?: number;
    flats_per_floor?: number;
    rooms_per_flat?: number;
    flats_total?: number;
    villas_total?: number;
    beds_per_unit?: number;
  };
}

export const BUILDINGS: Record<BuildingCode, BuildingConfig> = {
  'chalapathi-main': {
    code: 'chalapathi-main',
    name: 'Chalapathi Main Building',
    short_name: 'Chalapathi',
    fee: {
      yearly_fee: 95_000,
      electricity_fee: 5_000,
      non_refundable_fee: 2_000,
      semester_split: true,
    },
    hierarchy: {
      has_floors: false,
      has_flats: true,
      has_villas: false,
      has_rooms_in_flats: false,
      beds_per_unit: 6,
    },
    planned_capacity: 300, // 50 flats × 6
    seed: { flats_total: 50, beds_per_unit: 6 },
  },

  stanza: {
    code: 'stanza',
    name: 'Stanza',
    short_name: 'Stanza',
    fee: {
      yearly_fee: 85_000,
      electricity_fee: 0,
      non_refundable_fee: 2_000,
      semester_split: true,
    },
    hierarchy: {
      has_floors: true,
      has_flats: true,
      has_villas: false,
      has_rooms_in_flats: true,
      beds_per_unit: 3,
    },
    planned_capacity: 60, // 5 floors × 2 flats × 2 rooms × 3
    seed: { floors: 5, flats_per_floor: 2, rooms_per_flat: 2, beds_per_unit: 3 },
  },

  villas: {
    code: 'villas',
    name: 'Villas',
    short_name: 'Villas',
    fee: {
      yearly_fee: 100_000,
      electricity_fee: 0,
      non_refundable_fee: 2_000,
      semester_split: true,
    },
    hierarchy: {
      has_floors: false,
      has_flats: false,
      has_villas: true,
      has_rooms_in_flats: false,
      beds_per_unit: 15,
    },
    planned_capacity: 60, // 4 villas × 15
    seed: { villas_total: 4, beds_per_unit: 15 },
  },

  'siddha-middle': {
    code: 'siddha-middle',
    name: 'Siddha Middle Block',
    short_name: 'Siddha',
    fee: {
      yearly_fee: 85_000,
      electricity_fee: 5_000,
      non_refundable_fee: 2_000,
      semester_split: true,
    },
    // Capacity not given by the client. Admin will configure floors/flats/rooms
    // through the Buildings settings page; no seed numbers here.
    hierarchy: {
      has_floors: true,
      has_flats: true,
      has_villas: false,
      has_rooms_in_flats: true,
      beds_per_unit: 3,
    },
    planned_capacity: 0,
  },
};

export const BUILDING_CODES: BuildingCode[] = Object.keys(
  BUILDINGS,
) as BuildingCode[];

/** Yearly fee + electricity + non-refundable. */
export function totalPayable(code: BuildingCode): number {
  const f = BUILDINGS[code].fee;
  return f.yearly_fee + f.electricity_fee + f.non_refundable_fee;
}

/** Half of the yearly fee (electricity + non-refundable still due upfront). */
export function semesterInstallment(code: BuildingCode): number {
  return BUILDINGS[code].fee.yearly_fee / 2;
}
