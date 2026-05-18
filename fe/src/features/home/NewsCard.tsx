// NewsItem 타입 가져오기 (뉴스 데이터 형태 정의)
import type { NewsItem } from "../../types/home";

// Props 타입 — 컴포넌트가 받는 props의 형태
type Props = {
  item: NewsItem;  // 뉴스 데이터 객체
};

/**
 * NewsCard: 단일 뉴스 카드
 * - 클릭하면 외부 뉴스 사이트를 새 탭에서 엶
 * - HomePage와 NewsPage 양쪽에서 사용
 */
export default function NewsCard({ item }: Props) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:bg-white/8 hover:-translate-y-[2px] active:translate-y-0"
    >
      {/* 좌측 썸네일 + 우측 텍스트 가로 레이아웃. */}
      {/* imageUrl 없거나 깨지면 회색 placeholder를 보여서 카드 폭이 항상 일정. */}
      <div className="flex items-stretch gap-4">
        <div className="relative hidden w-40 shrink-0 overflow-hidden bg-white/10 sm:block">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
              onError={(e) => {
                // 깨진 이미지 → placeholder로 fallback (영역 자체는 유지)
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-10 w-10 text-white/25"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="11" r="1.5" />
                <path d="M21 17l-5-5-6 6" />
              </svg>
            </div>
          )}
        </div>

        {/* 텍스트 영역 */}
        <div className="relative flex-1 p-5">
          {/* "Open →" 표시 — 우측 상단 코너에 절대 배치해서 제목이 카드 맨 위에 붙도록 함 */}
          <div className="absolute right-5 top-5 text-xs text-white/40 group-hover:text-white/60 transition">
            Open →
          </div>

          {/* 뉴스 제목 — 우측의 Open 라벨과 겹치지 않도록 pr-12 여백 확보 */}
          <h3 className="pr-12 text-base font-semibold text-white">{item.title}</h3>
          {/* 뉴스 요약 (line-clamp-2: 최대 2줄까지만 표시, 넘치면 ...) */}
          <p className="mt-2 line-clamp-2 text-sm text-white/70">{item.summary}</p>
        </div>
      </div>
    </a>
  );
}
