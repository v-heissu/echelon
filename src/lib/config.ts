/**
 * Central app configuration derived from environment variables.
 * All beta-mode checks MUST use this helper so switching source
 * (env → DB toggle) later requires changing only this file.
 */
export function isBetaMode(): boolean {
  return process.env.NEXT_PUBLIC_LAUNCH_MODE === 'beta';
}
