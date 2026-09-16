"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600 }}>문제가 발생했어요.</p>
          <p style={{ fontSize: 14, color: "#6f7791" }}>페이지를 새로고침해주세요.</p>
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 9999,
              border: 0,
              background: "#5b7cfa",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
