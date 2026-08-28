export const ADVISORS_VIEWER_CODE = "A9999";

export function isAdvisorsOnlyUser(userCode?: string | null) {
  return (userCode ?? "").trim().toUpperCase() === ADVISORS_VIEWER_CODE;
}
