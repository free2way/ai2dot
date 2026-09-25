export type GreetingPeriod = "late" | "morning" | "afternoon" | "evening";

export function getGreetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18) return "evening";
  return "late";
}

export function getGreetingText(
  language: "zh" | "en",
  hour: number | null,
) {
  if (hour === null) return language === "en" ? "Hello" : "你好";

  const period = getGreetingPeriod(hour);
  if (language === "en") {
    if (period === "morning") return "Good morning";
    if (period === "afternoon") return "Good afternoon";
    return "Good evening";
  }

  if (period === "morning") return "早上好";
  if (period === "afternoon") return "下午好";
  if (period === "evening") return "晚上好";
  return "夜深了";
}
