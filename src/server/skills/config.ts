import "server-only";

function enabledUnlessExplicitlyDisabled(value: string | undefined) {
  return value?.trim().toLowerCase() !== "false";
}

export function isExplicitSkillsEnabled() {
  return enabledUnlessExplicitlyDisabled(
    process.env.AI2DOT_ENABLE_EXPLICIT_SKILLS,
  );
}

export function isSkillLibraryEnabled() {
  return enabledUnlessExplicitlyDisabled(process.env.AI2DOT_ENABLE_SKILL_LIBRARY);
}
