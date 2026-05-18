// React Router의 핵심 함수/컴포넌트 가져오기
// - createBrowserRouter: URL 기반 라우터 생성 (History API 사용)
// - Navigate: 선언형 리다이렉트 컴포넌트 (다른 URL로 이동)
import { createBrowserRouter, Navigate } from "react-router-dom";

// 공통 레이아웃 — Navbar + 페이지 내용 래퍼
import AppLayout from "./components/AppLayout";
// 로그인 필요한 페이지를 감싸는 가드 컴포넌트
import ProtectedRoute from "./components/ProtectedRoute";

// 각 URL에 대응하는 페이지 컴포넌트 가져오기
import HomePage from "./pages/HomePage";
import DraftPage from "./pages/DraftPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import NewsPage from "./pages/NewsPage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";

// router: URL과 페이지를 매핑하는 중앙 설정
// - 배열 형태로 라우트를 정의
// - 중첩 구조 (children)를 지원해서 공통 레이아웃을 쉽게 적용 가능
export const router = createBrowserRouter([
  {
    path: "/",                    // 최상위 경로
    element: <AppLayout />,       // 모든 하위 페이지를 이 레이아웃으로 감쌈
    children: [
      // index: true → 정확히 "/" 경로일 때 렌더링되는 페이지
      { index: true, element: <HomePage /> },

      // 각 URL과 페이지 매핑
      { path: "news", element: <NewsPage /> },

      // 미저장 드래프트 모드: sessionStorage 의 ppadun_unsaved_draft 사용
      { path: "draft", element: <DraftPage /> },
      // 저장된 세션 모드: 서버에서 SessionDetail 재로드
      { path: "draft/:sessionId", element: <DraftPage /> },

      // 선수 상세 페이지 — sessionId 와 충돌하지 않도록 /players/:id 에서 직접 서빙
      { path: "players/:id", element: <PlayerDetailPage /> },

      { path: "login", element: <LoginPage /> },

      // ── 레거시 URL 호환 리다이렉트 ──
      { path: "players", element: <Navigate to="/draft" replace /> },
      { path: "settings", element: <Navigate to="/my-team" replace /> },

      // ── 로그인 필요한 페이지 ──
      // ProtectedRoute로 감싸면 로그인 안 한 유저는 /login으로 자동 리다이렉트
      {
        element: <ProtectedRoute />,
        children: [{ path: "my-team", element: <MyTeamPage /> }],
      },
    ],
  },
]);
