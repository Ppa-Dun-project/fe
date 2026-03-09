function readEnvValue(rawValue: string | undefined, fallback: string) {
  const trimmed = rawValue?.trim();
  return trimmed ? trimmed : fallback;
}

export const DRAFT_ROOM_ID = readEnvValue(import.meta.env.VITE_DRAFT_ROOM_ID, "default");
export const MY_TEAM_ID = readEnvValue(import.meta.env.VITE_MY_TEAM_ID, "team-me");
