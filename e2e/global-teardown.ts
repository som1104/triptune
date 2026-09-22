import { cleanupRunData } from "./support/cleanup";

/** 성공하든 실패하든, 이 실행이 만든 데이터만 정리한다. */
export default async function globalTeardown(): Promise<void> {
  await cleanupRunData();
}
