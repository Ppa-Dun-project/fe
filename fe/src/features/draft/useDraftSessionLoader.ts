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

  // 마운트 분기:
  //  - sessionId 있음(로드 모드): GET /api/draft/sessions/{id}. 404 → 홈.
  //  - 그 외(미저장 모드): sessionStorage 에서 unsaved draft 를 복원하거나
  //    DEFAULT_DRAFT_CONFIG 로 player browser 시작.
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
          // 404 또는 기타 실패 → 홈으로
          navigate("/", { replace: true });
        });

      return () => controller.abort();
    }

    // 미저장 모드 — sessionStorage 가 있으면 resume, 없으면 default config.
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

  // 로드 모드 전용 — 서버에서 메모 가져오기. 미저장 모드는 위 effect 가 sessionStorage 에서 채워줌.
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
