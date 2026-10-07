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

/** 입력칸도 같은 이유로 두 벌 그려질 수 있다. */
export function field(page: Page, label: string | RegExp, exact?: boolean): Locator {
  return page.getByLabel(label, { exact }).filter({ visible: true }).first();
}

/** 지금 보고 있는 주소가 그 링크인지 (쿼리·해시는 무시). */
export function onPage(page: Page, link: string): boolean {
  const strip = (value: string) => value.split("?")[0].split("#")[0].replace(/\/$/, "");
  try {
    return strip(new URL(page.url()).pathname) === strip(new URL(link).pathname);
  } catch {
    return false;
  }
}
