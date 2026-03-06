export type Player = {
  id: number;
  name: string;
  team: string;
  positions: string[]; // e.g. ["OF"], ["2B","OF"], ["P"]
  valueScore: number;
  headshotUrl?: string | null;
};

export type PlayerSort = "value_desc" | "value_asc" | "name_asc" | "name_desc";
