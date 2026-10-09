import { describe, expect, it } from "vitest";
import { getGreetingPeriod, getGreetingText } from "@/lib/greeting";

describe("time-aware greeting", () => {
  it.each([
    [0, "late"],
    [4, "late"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [23, "evening"],
  ] as const)("maps hour %i to %s", (hour, expected) => {
    expect(getGreetingPeriod(hour)).toBe(expected);
  });

  it("uses a hydration-safe neutral greeting before browser time is known", () => {
    expect(getGreetingText("zh", null)).toBe("你好");
    expect(getGreetingText("en", null)).toBe("Hello");
  });

  it("localizes the greeting", () => {
    expect(getGreetingText("zh", 9)).toBe("早上好");
    expect(getGreetingText("zh", 14)).toBe("下午好");
    expect(getGreetingText("zh", 20)).toBe("晚上好");
    expect(getGreetingText("zh", 2)).toBe("夜深了");
    expect(getGreetingText("en", 9)).toBe("Good morning");
  });
});
