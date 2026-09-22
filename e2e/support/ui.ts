import type { Locator, Page } from "@playwright/test";

/**
 * 같은 버튼이 모바일용과 데스크톱용으로 두 번 그려지는 화면이 많다
 * (한쪽은 CSS 로 숨겨져 있다). 순서로 고르면 숨은 쪽을 집게 되므로,
 * 언제나 "지금 보이는 것" 중 첫 번째를 쓴다.
 */
export function button(page: Page, name: string | RegExp, exact?: boolean): Locator {
  return page.getByRole("button", { name, exact }).filter({ visible: true }).first();
}

export function link(page: Page, name: string | RegExp): Locator {
  return page.getByRole("link", { name }).filter({ visible: true }).first();
}

export function text(page: Page, value: string | RegExp, exact?: boolean): Locator {
  return page.getByText(value, { exact }).filter({ visible: true }).first();
}
