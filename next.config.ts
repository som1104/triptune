import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /* 클라이언트 라우터 캐시. 기본값 0 이라 이미 본 탭으로 돌아가도 RSC 를
       매번 다시 받아오고, 그게 탭을 옮길 때마다 로딩이 반복되는 이유였다.
       30초 동안은 재조회 없이 즉시 그린다 — 캐시는 브라우저 탭 안에만 있고
       새로고침하면 사라지므로 다른 사용자의 데이터가 섞일 수 없다.
       여행 단계가 바뀌면 Realtime 이 router.refresh() 로 즉시 무효화한다. */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    /* 모든 경로가 동적이라 기본 프리페치는 껍데기만 받아온다. 마우스를 올린
       순간 본문까지 미리 받아두면 데스크톱에서 클릭이 곧바로 그려진다.
       터치 기기에는 hover 가 없어 추가 요청이 생기지 않는다. */
    dynamicOnHover: true,
  },
};

export default nextConfig;
