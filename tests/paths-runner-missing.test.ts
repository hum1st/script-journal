jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: jest.fn(() => false),
  };
});

import { resolveRunnerPath } from "../src/paths";

describe("resolveRunnerPath – 缺失", () => {
  test("找不到 runner.mjs 时抛错", () => {
    expect(() => resolveRunnerPath()).toThrow(/cannot find runner\.mjs/);
  });
});
