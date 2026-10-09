import { describe, expect, it } from "vitest";
import { clerkUserToProfile } from "@/server/auth/clerk-profile";

describe("Clerk user profiles", () => {
  it("uses the primary email and full name", () => {
    expect(
      clerkUserToProfile({
        id: "user_123",
        fullName: "Lin Chen",
        username: "linchen",
        primaryEmailAddress: { emailAddress: "lin@example.com" },
        emailAddresses: [{ emailAddress: "other@example.com" }],
        imageUrl: "https://img.example.com/lin.png",
      } as never),
    ).toEqual({
      externalAuthId: "user_123",
      displayName: "Lin Chen",
      email: "lin@example.com",
      avatarUrl: "https://img.example.com/lin.png",
    });
  });

  it("falls back to the first email and its local part", () => {
    expect(
      clerkUserToProfile({
        id: "user_456",
        fullName: null,
        username: null,
        primaryEmailAddress: null,
        emailAddresses: [{ emailAddress: "fallback@example.com" }],
        imageUrl: "",
      } as never),
    ).toMatchObject({
      displayName: "fallback",
      email: "fallback@example.com",
      avatarUrl: null,
    });
  });
});
