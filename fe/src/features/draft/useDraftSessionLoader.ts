// Loads the draft session on mount.
//
// Two cooperating effects:
// 1. Bootstrap — branches on URL mode.
//    - Loaded mode (`/draft/:sessionId`)   → GET session detail, hydrate state.
//      Redirects to "/" on 404 / other errors.
//    - Unsaved mode (`/draft`)             → read sessionStorage and resume,
//      otherwise fall back to DEFAULT_DRAFT_CONFIG so the player browser shows
//      a default roster shape.
// 2. Notes fetch — only in loaded mode, fetches the saved per-player notes
//    via a separate endpoint and merges into the parent's notes state.
//    (Unsaved mode picks up notes from sessionStorage in step 1.)
//
// State is owned by DraftPage; this hook just runs the side effects against
// setters passed in. That keeps the rest of the page unchanged.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiGetAuth } from "../../lib/api";
import type {
  DraftConfigServer,
  DraftPick,
  DraftTeam,
  PlayerNote,
  SessionDetail,
} from "../../types/draft";
import {
  DEFAULT_DRAFT_CONFIG,
  buildTeamsFromConfig,
  normalizeDraftPicks,
  readUnsavedDraftStorage,
  type UnsavedDraft,
} from "./draftHelpers";

type Params = {
  isLoadedMode: boolean;
  sessionId: number | null;
  setConfig: (config: DraftConfigServer) => void;
  setHasDraftConfig: (next: boolean) => void;
  setTeams: (teams: DraftTeam[]) => void;
  setSessionName: (name: string | null) => void;
  setBootstrapped: (next: boolean) => void;
  setNotes: (notes: Record<string, string>) => void;
  resetPicks: (picks: DraftPick[]) => void;
};

export function useDraftSessionLoader({
  isLoadedMode,
  sessionId,
  setConfig,
  setHasDraftConfig,
  setTeams,
  setSessionName,
  setBootstrapped,
  setNotes,
  resetPicks,
}: Params) {
  const navigate = useNavigate();

  // Mount branching:
  //  - sessionId present (loaded mode): GET /api/draft/sessions/{id}. 404 → home.
  //  - Otherwise (unsaved mode): restore the unsaved draft from sessionStorage,
  //    or start the player browser with DEFAULT_DRAFT_CONFIG.
  useEffect(() => {
    if (isLoadedMode) {
      const controller = new AbortController();

      apiGetAuth<SessionDetail>(
        `/api/draft/sessions/${sessionId}`,
        undefined,
        controller.signal,
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          setConfig(data.config);
          setHasDraftConfig(true);
          setTeams(data.teams);
          resetPicks(normalizeDraftPicks(data.picks ?? []));
          setSessionName(data.name);
          setBootstrapped(true);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error(err);
          // 404 or other failure → redirect home
          navigate("/", { replace: true });
        });

      return () => controller.abort();
    }

    // Unsaved mode — resume from sessionStorage if present, otherwise use the default config.
    let parsed: UnsavedDraft | null = null;
    try {
      const raw = readUnsavedDraftStorage();
      if (raw) parsed = JSON.parse(raw) as UnsavedDraft;
    } catch {
      parsed = null;
    }

    const ready: UnsavedDraft = parsed?.config
      ? parsed
      : { config: DEFAULT_DRAFT_CONFIG, picks: [] };
    queueMicrotask(() => {
      setConfig(ready.config);
      setHasDraftConfig(Boolean(parsed?.config));
      setTeams(buildTeamsFromConfig(ready.config));
      resetPicks(normalizeDraftPicks(ready.picks ?? []));
      setNotes(ready.notes ?? {});
      setSessionName(null);
      setBootstrapped(true);
    });
    // Setters are stable; only branch keys matter for re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadedMode, navigate, sessionId]);

  // Loaded mode only — fetches notes from the server. In unsaved mode the effect above fills these in from sessionStorage.
  useEffect(() => {
    if (!isLoadedMode || sessionId === null) return;
    const controller = new AbortController();
    apiGetAuth<{ items: PlayerNote[] }>(
      `/api/draft/sessions/${sessionId}/notes`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const map: Record<string, string> = {};
        for (const it of data.items ?? []) map[it.playerId] = it.note;
        setNotes(map);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setNotes({});
      });
    return () => controller.abort();
    // setNotes is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadedMode, sessionId]);
}
