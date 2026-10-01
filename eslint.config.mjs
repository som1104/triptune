import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 우리가 쓴 코드가 아닌 것들 — 디자인 시스템 번들과 테스트 결과물.
    // 모두 .gitignore 에 올라가 있고, 고칠 수 있는 소스가 아니다.
    "triptune-design/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
