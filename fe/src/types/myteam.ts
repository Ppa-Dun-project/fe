export type MyTeamPlayer = {
  id: string;
  name: string;
  pos: string;      // DH, RF, SS, SP...
  cost: number;     // $ (winning bid)
  team: string;     // MLB team
  avg: number;      // batting avg
  hr: number;
  rbi: number;
  sb: number;
  ppaValue: number; // PPA-DUN Value (valueScore)
};