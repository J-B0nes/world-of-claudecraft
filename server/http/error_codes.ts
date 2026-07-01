// Stable error-code catalog for the API pipeline (Phase 7 of docs/api-pipeline/).
//
// The SINGLE source of truth for machine error codes. A code is a stable
// `domain.reason` identifier, NEVER English prose: the Phase 7 serializers
// (errors.ts) reference these literally and the client re-localizes a code to
// player text in Phase 22. This module is pure data plus types: it has ZERO
// imports, no DOM, and no sim/client dependency.
//
// APPEND-ONLY (AIP-193): codes are permanent. Never renumber, rename, or remove an
// existing code; only ADD new ones. Renaming a code silently breaks the client
// matcher and every persisted reference. The snapshot test
// (tests/server/http/error_codes.test.ts) fails if a code is removed or renamed.
//
// Each value is `{ params }`, where params is the ordered list of placeholder names
// the code's localized message interpolates (empty when the code carries none). The
// `as const` pins the literal types; deepFreeze pins runtime immutability.

/** Recursively freeze an object and its nested objects/arrays. */
function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

export const ERROR_CODES = deepFreeze({
  // --- Structural codes (the 9 pipeline primitives; the Phase 7 serializers map an
  // HTTP status onto these). Do not change these names or param keys. ---
  'validation.failed': { params: ['issues'] },
  'json.malformed': { params: [] },
  'auth.token_missing': { params: [] },
  'auth.token_invalid': { params: [] },
  'auth.forbidden': { params: [] },
  'body.too_large': { params: ['maxBytes'] },
  'db.conflict': { params: [] },
  'rate_limit.exceeded': { params: ['retryAfterSeconds'] },
  'internal.error': { params: [] },

  // --- Harvested user-facing identities (seeded from src/main.ts userFacingApiError;
  // Phase 22 wires the client matcher to these). One code per existing identity; the
  // identity comment names the English source string(s) the code stands in for. ---

  // auth: authentication, session, and credential-check failures.
  // identity: "invalid username or password"
  'auth.invalid_credentials': { params: [] },
  // identity: "not authenticated" / "authentication required"
  'auth.required': { params: [] },
  // identity: "logins are only allowed from the game client"
  'auth.web_login_only': { params: [] },
  // identity: "too many attempts ..." (login rate-limit message)
  'auth.too_many_attempts': { params: [] },
  // identity: "too many failed attempts ..." (brute-force throttle)
  'auth.too_many_failed_attempts': { params: [] },
  // identity: "current password is incorrect"
  'auth.current_password_incorrect': { params: [] },
  // identity: "password is incorrect"
  'auth.password_incorrect': { params: [] },
  // identity: "verification failed, please try again" (Turnstile bot gate)
  'auth.verification_failed': { params: [] },

  // account: account-field validation and self-service account state.
  // identity: "username must be 3-24 chars (letters, digits, _)"
  'account.username_invalid': { params: [] },
  // identity: "username is not allowed"
  'account.username_not_allowed': { params: [] },
  // identity: "username already taken"
  'account.username_taken': { params: [] },
  // identity: "username does not match"
  'account.username_mismatch': { params: [] },
  // identity: "password must be at least 6 chars"
  'account.password_too_short': { params: [] },
  // identity: "password must be at most 128 chars"
  'account.password_too_long': { params: [] },
  // identity: "log out all characters before deactivating"
  'account.characters_online': { params: [] },
  // identity: "this account has been deactivated."
  'account.deactivated': { params: [] },
  // identity: "account not found" (the account row vanished mid-session)
  'account.not_found': { params: [] },

  // character: character creation, selection, and world-entry failures.
  // identity: "invalid character name (2-16 letters)"
  'character.name_invalid': { params: [] },
  // identity: "character name is not allowed"
  'character.name_not_allowed': { params: [] },
  // identity: "invalid class"
  'character.invalid_class': { params: [] },
  // identity: "character limit reached"
  'character.limit_reached': { params: [] },
  // identity: "that name is taken" (character name)
  'character.name_taken': { params: [] },
  // identity: "character not found" / "no such character" / "not found"
  'character.not_found': { params: [] },
  // identity: "character is currently online"
  'character.online': { params: [] },
  // identity: "character rename is not permitted"
  'character.rename_not_permitted': { params: [] },
  // identity: "type the character name to confirm deletion"
  'character.delete_confirm': { params: [] },
  // identity: "character already in world"
  'character.already_in_world': { params: [] },
  // identity: "character taken over"
  'character.taken_over': { params: [] },
  // identity: "this character must be renamed before entering the world."
  'character.rename_required': { params: [] },

  // moderation: enforcement states set by a moderator.
  // identity: "this account is suspended until {date}."
  'moderation.suspended_until': { params: ['date'] },
  // identity: "this account is suspended."
  'moderation.suspended': { params: [] },
  // identity: "this account has been banned."
  'moderation.banned': { params: [] },
  // identity: "a moderator requires one of your characters to be renamed."
  'moderation.force_rename': { params: [] },

  // email: email-change validation.
  // identity: "enter a valid email address"
  'email.invalid': { params: [] },
  // identity: "that is already your email address"
  'email.unchanged': { params: [] },

  // two_factor: two-factor setup and verification state.
  // identity: "that code is not valid, try again" / "invalid authentication code"
  'two_factor.code_invalid': { params: [] },
  // identity: "start two-factor setup first"
  'two_factor.setup_required': { params: [] },
  // identity: "two-factor is already enabled"
  'two_factor.already_enabled': { params: [] },
  // identity: "two-factor is not enabled"
  'two_factor.not_enabled': { params: [] },
} as const);

/** A stable error code: one of the keys of ERROR_CODES. */
export type ErrorCode = keyof typeof ERROR_CODES;
