import fs from "node:fs";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { ROOT } from "./env";

/* ------------------------------------------------------------------
   화면 캡처.

   한 번 흐름을 밟으면서 모든 단계를 flow/ 에 남기고, 그중 대표 화면만
   portfolio/ 에도 복사한다. 흐름을 두 번 돌릴 필요가 없다.
   ------------------------------------------------------------------ */

const OUT = path.join(ROOT, "screenshots");

export class Shots {
  private n = 0;
  private readonly viewport: string;

  constructor(testInfo: TestInfo) {
    // 프로젝트 이름이 shots-mobile / shots-desktop 이다.
    this.viewport = testInfo.project.name.replace(/^shots-/, "");
  }

  /** 이 실행이 쓸 폴더를 비운다 — 이전 캡처가 섞이지 않게. */
  static reset(viewport: string): void {
    for (const kind of ["flow", "portfolio"]) {
      const dir = path.join(OUT, kind, viewport);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 한 장 찍는다.
   * @param name   파일 이름에 들어갈 한글 설명
   * @param key    portfolio 에도 남길 대표 화면이면 true
   */
  async take(page: Page, name: string, key = false): Promise<void> {
    this.n += 1;
    const file = `${String(this.n).padStart(2, "0")}-${name}.png`;

    // 애니메이션이 끝난 뒤를 찍는다 — 시트가 반쯤 올라온 장면이 남지 않게.
    await page.waitForTimeout(250);

    const flowPath = path.join(OUT, "flow", this.viewport, file);
    await page.screenshot({ path: flowPath });
    if (key) {
      fs.copyFileSync(flowPath, path.join(OUT, "portfolio", this.viewport, file));
    }
  }

  /**
   * 특정 구간을 보여주고 싶을 때. 그 자리가 화면 위쪽에 오도록 스크롤한 뒤 찍는다.
   * (scrollIntoViewIfNeeded 는 최소한만 움직여서 찾던 구간이 화면 맨 아래에
   *  걸리기 쉽다. 여기서는 위로 올리고, 고정 앱바에 가리지 않게 조금 띄운다.)
   */
  async takeAt(page: Page, target: Locator, name: string, key = false): Promise<void> {
    await target.scrollIntoViewIfNeeded();
    await target.evaluate((el) => {
      el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
      window.scrollBy(0, -80);
    });
    await this.take(page, name, key);
  }
}
