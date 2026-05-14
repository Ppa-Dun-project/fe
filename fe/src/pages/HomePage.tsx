// useState: 컴포넌트 내부 상태 관리 훅
import { useEffect, useState } from "react";
// useNavigate: 프로그래매틱 페이지 이동 훅
import { useNavigate } from "react-router-dom";

// 공통 UI 컴포넌트
import FadeIn from "../components/ui/FadeIn";          // 페이드 인 애니메이션 래퍼
import NewsCard from "../features/home/NewsCard";      // 뉴스 카드 컴포넌트
import InjuredPlayersStrip from "../features/home/InjuredPlayersStrip"; // 부상 선수 strip + popup
import type { NewsItem } from "../types/home";

const MLB_RSS_URL = "https://sports.yahoo.com/mlb/rss/";
const RSS_TO_JSON_API = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(MLB_RSS_URL)}`;

type Rss2JsonItem = {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  thumbnail?: string;
  content?: string;        // HTML body — 첫 <img> 태그에서 썸네일 URL 추출에 사용
};

// rss2json content HTML에서 첫 번째 <img> 태그의 src 속성을 뽑는다.
// Yahoo Sports feed는 thumbnail 필드는 비어있지만 content 안에 이미지를 포함.
// 70% 정도의 항목에 이미지가 있고, 없는 항목은 undefined → 카드가 텍스트만 렌더.
const IMG_SRC_RE = /<img[^>]+src="([^"]+)"/i;
const extractImageUrl = (html: string | undefined): string | undefined =>
  html ? html.match(IMG_SRC_RE)?.[1] : undefined;

// 히어로 배너 배경 이미지
import baseballImg from "../assets/Baseball.jpg";

/**
 * HomePage: 랜딩 페이지
 * - 상단: 히어로 배너 + 검색창
 * - 좌측: 최신 뉴스 카드 3개
 * - 우측: 부상 선수 명단
 */
export default function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");      // 히어로 검색창 입력값
  const [news, setNews] = useState<NewsItem[]>([]);

  // MLB RSS 피드를 rss2json 프록시로 가져와 최신 4개만 표시
  // 페이지를 열어둔 동안에도 새로 올라오는 뉴스를 반영하기 위해 1시간마다 polling
  useEffect(() => {
    const fetchNews = () => {
      fetch(RSS_TO_JSON_API)
        .then((r) => r.json())
        .then((data: { items?: Rss2JsonItem[] }) => {
          const items = (data.items ?? []).slice(0, 3).map<NewsItem>((it) => ({
            id: it.guid,
            title: it.title,
            // RSS description은 HTML 포함 — 태그 제거해서 깨끗한 텍스트만 사용
            summary: (it.description ?? "").replace(/<[^>]+>/g, "").trim(),
            publishedAt: it.pubDate,
            url: it.link,
            source: "Yahoo Sports",
            imageUrl: extractImageUrl(it.content),
          }));
          setNews(items);
        })
        .catch(() => setNews([]));
    };

    fetchNews();
    const interval = setInterval(fetchNews, 60 * 60 * 1000); // 1시간마다
    return () => clearInterval(interval);
  }, []);

  // 검색 실행 — 드래프트 페이지로 이동 (쿼리 URL 파라미터로 전달)
  const onSearch = () => {
    const q = query.trim();
    if (!q) return;  // 빈 값이면 무시
    // encodeURIComponent: URL에 안전하게 포함되도록 특수문자 인코딩
    navigate(`/draft?query=${encodeURIComponent(q)}`);
  };

  return (
    // space-y-8: 세로 방향 자식 요소 사이 간격 2rem
    <div className="space-y-8">
      <FadeIn>
        {/* 히어로 배너 */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black p-6 md:p-10">
          {/* 배경 이미지 레이어 */}
          <div className="absolute inset-0">
            <img
              src={baseballImg}
              alt="Baseball background"
              className="h-full w-full object-cover object-right origin-right scale-80 brightness-145 saturate-110"
            />
            {/* 그라데이션 오버레이 (왼쪽 검정 → 오른쪽 투명) */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
            {/* 안쪽 그림자 효과 */}
            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]" />
          </div>

          {/* 전경 콘텐츠 (텍스트 + 검색창) */}
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              {/* 작은 태그 */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70">
                PPA-Dun Project • TEAM BLACK
              </div>
              {/* 메인 제목 */}
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                Build your roster with the Best Players.
              </h1>
              {/* 부제 */}
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Check the latest news, scout top players for your Fantasy.
              </p>
            </div>

            {/* 검색창 */}
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur">
                <input
                  value={query}
                  // onChange: 입력 시마다 상태 업데이트 (controlled input)
                  onChange={(e) => setQuery(e.target.value)}
                  // onKeyDown: Enter 키로 검색 실행
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  placeholder="Search players (e.g., Judge, Ohtani)..."
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
                />
                <button
                  onClick={onSearch}
                  className="rounded-xl bg-black/80 px-4 py-2 text-sm font-extrabold text-white
                             ring-1 ring-white/25
                             transition hover:translate-y-[-1px] hover:bg-black/70 hover:ring-white/40
                             active:translate-y-0"
                >
                  Search
                </button>
              </div>
              <div className="mt-2 text-xs text-white/60">Tip: Press Enter to search.</div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* 뉴스 + 부상 선수 2열 그리드 */}
      {/* grid-cols-1: 기본 1열 / lg:grid-cols-3: 큰 화면에서 3열 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측 뉴스 섹션 (3열 중 2열 차지) */}
        <FadeIn className="lg:col-span-2" delayMs={60}>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Latest News</h2>
                <p className="mt-1 text-xs text-white/50">
                  Fetched from Yahoo Sports · refreshes every hour
                </p>
              </div>
              {/* "모두 보기" 버튼 → Yahoo Sports MLB 뉴스 페이지로 외부 이동 */}
              <a
                href="https://sports.yahoo.com/mlb/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-white/60 hover:text-white transition"
              >
                View all →
              </a>
            </div>

            {/* 뉴스 카드 3개 렌더링 (배열.map으로 반복) */}
            <div className="mt-5 grid grid-cols-1 gap-4">
              {news.map((item) => (
                // key: React가 리스트 항목을 식별하기 위한 고유값 (필수)
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </FadeIn>

        {/* 우측 부상 선수 섹션 (3열 중 1열) */}
        <FadeIn className="lg:col-span-1" delayMs={120}>
          <InjuredPlayersStrip />
        </FadeIn>
      </div>
    </div>
  );
}
