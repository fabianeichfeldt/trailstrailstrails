# Spot Comments — Design Spec

**Date:** 2026-08-11
**Status:** Approved, pending implementation

## Purpose

Add a comments feature to spots (trails, bikeparks, dirtparks) so the community can discuss current trail state, leave feedback, and generally converse about a spot. Reading comments is public; writing requires login. This is deliberately a general freeform discussion feature, distinct from the trailcrew-managed official status/status-hint fields in `trail_details` — comments are informal community chatter, not authoritative state.

## Scope decisions

- **Format:** freeform text only, no structured tags (no "condition report" vs "feedback" distinction).
- **Threading:** flat list, no nested replies. A lightweight reply convention exists (see below) but is purely textual, not a DB relationship.
- **Spot types:** available on all spot types (trail, bikepark, dirtpark), same as `trail_photos`.
- **Editing:** not supported. Users delete and repost instead.
- **Activity feed:** comments do **not** appear in the global activity feed (`src/communication/activity.ts`). They stay spot-local.
- **UI placement:** map popup only (`src/map/detail_popup/detailsPopup.ts`), not the SEO page (`src/pages/trails/[slug].vue`).

## 1. Data model

New table `spot_comments`, modeled on `trail_photos` (`supabase/migrations/20260514075528_remote_schema.sql:417-423`):

```sql
create table spot_comments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trail_id text not null,        -- same loose convention as trail_photos.trail_id, spans trail/bikepark/dirtpark
  user_id uuid not null references auth.users(id),
  comment_text text not null check (char_length(comment_text) <= 500 and char_length(comment_text) > 0)
);
```

**Correction after implementation research:** the column is named `spot_id`, not `trail_id`, and carries no FK (mirroring `parking.spot_id`) — `trail_photos.trail_id` has an FK to `trails(id)` only, which would have silently broken comments on bikeparks/dirtparks. `spot_id` also gets two FK constraints to `auth.users`/`profiles` on `user_id` (not on `spot_id`), same two-FK-for-PostgREST-join trick `trail_photos.creator` uses.

- **Hard delete** — no soft-delete or audit trail. Nothing in scope requires comment history after removal.
- **No `parent_comment_id` column.** Replies are handled purely in the UI: clicking "Reply" prefills the compose textarea with `@display_name `. No structured link between comments.
- Author display name/avatar resolved via join to `profiles(display_name, avatar_url)` (`profiles` table: `supabase/migrations/20260514075528_remote_schema.sql:271-276`), same pattern as `Photo.profiles` in `src/types/Photo.ts:5-8`.

### RLS policies

- `SELECT`: public — `TO anon USING (true)`, same as `trail_photos`'s public read policy.
- `INSERT`: `TO authenticated WITH CHECK (auth.uid() = user_id)`.
- `DELETE`: `USING (auth.uid() = user_id OR can_edit_spot(spot_id))`. Reuses the existing `can_edit_spot()` function (defined `supabase/migrations/20260514075528_remote_schema.sql:79-84`), so both the comment's author and any admin/assigned-trailcrew get delete rights, with no new authorization logic introduced.
- No `UPDATE` policy — editing is not supported.

### Rate limiting

A `BEFORE INSERT` trigger on `spot_comments` rejects a new row if the same `user_id` already has a comment on the same `spot_id` with `created_at` within the last 60 seconds. The trigger raises a Postgres exception, which the client surfaces as a "slow down" inline error.

### Migration file

`supabase/migrations/20260811120000_add_spot_comments.sql`, containing the table, RLS policies, and the rate-limit trigger — following the structure of `supabase/migrations/20260731090000_simplify_parking_info.sql`.

## 2. Communication layer

New file `src/communication/comments.ts`, following the existing plain-function pattern in `src/communication/photos.ts` / `src/communication/trails.ts` (no store logic inside; uses `REST`/`anonHeaders()`/`userHeaders()` from `src/communication/http.ts`).

- `getComments(spotId: string): Promise<Comment[]>` — anon REST GET, joins `profiles(display_name, avatar_url)`, ordered `created_at desc`, limited to the latest 20.
- `getOlderComments(spotId: string, beforeCreatedAt: string): Promise<Comment[]>` — same query with a `created_at < beforeCreatedAt` cursor, powers "load older".
- `postComment(spotId: string, text: string, authService: IAuthService): Promise<Comment>` — pulls the access token from `authService.getUser()`, then an authenticated POST via `userHeaders(...)`. Mirrors `likeTrail`'s exact signature shape (`src/communication/trails.ts:106-123`), which is the established pattern for a simple per-user authenticated write tied to a trail — no Pinia store wrapper involved.
- `deleteComment(commentId: number, authService: IAuthService): Promise<void>` — same shape, authenticated DELETE. RLS is the actual authorization gate, so the client does not duplicate permission logic; no login guard needed client-side since the delete control is only ever rendered for a logged-in user in the first place.

New type in `src/types/Comment.ts`:

```ts
interface Comment {
  id: number
  created_at: string
  spot_id: string
  user_id: string
  comment_text: string
  profiles: { display_name: string; avatar_url: string | null }
}
```

Rate-limit and length-check violations from Postgres surface as thrown errors out of `postComment`; `SpotPanel` catches and displays them inline (see §3).

**No `stores/auth.ts` changes, no `IAuthService`/`authAdapter` changes.** The original spec assumed a Pinia store wrapper (`uploadTrailPhoto`'s pattern); implementation research showed `likeTrail`/`dislikeTrail` — a closer structural analog — bypass the store entirely via `IAuthService.getUser().accessToken`. Comments follow that simpler, already-established path.

## 3. UI — map popup

**Correction after implementation research:** `renderTrailDetails` is not a Vue component — it's invoked by `SpotPanel` (`src/map/spot_panel/spotPanel.ts`), a plain TS class that owns per-spot state (`parkingLots`, `data`, etc.) and does async sub-loads *after* the initial synchronous render, e.g. `loadParking()`/`renderParking()` (`spotPanel.ts:106-125`). Photos are the exception, not the template to copy — they arrive pre-embedded in `TrailDetails` from the `trail-details` Supabase Edge Function (a separate backend repo, out of scope here). Comments follow the **parking** pattern instead: a placeholder renders immediately as part of `renderTrailDetails`, then `SpotPanel` fetches and fills it in separately.

Also, the write/delete actions don't need a Pinia store wrapper or `IAuthService`/`authAdapter` changes — `likeTrail`/`dislikeTrail` (`src/communication/trails.ts:106-123`) are the closest analog (simple per-user authenticated action tied to a trail) and take `IAuthService` directly, pulling the token from `authService.getUser().accessToken`. `postComment`/`deleteComment` follow that exact shape.

**Changes:**
- `src/communication/comments.ts`: `getComments`/`getOlderComments` (anon REST GET, latest 20, cursor-paginated) + `postComment`/`deleteComment(..., authService: IAuthService)` (authenticated REST POST/DELETE via `userHeaders`), mirroring `likeTrail`/`dislikeTrail`.
- `detailsPopup.ts`: `renderTrailDetails()` embeds a placeholder container (`<div id="spot-comments-section">`) after the photo section. New pure function `renderCommentsList(comments, opts)` renders the collapsed count / expanded list / write box markup, called by `SpotPanel`, not by `renderTrailDetails` itself (comments aren't known synchronously).
- `SpotPanel`: new instance state (`comments: Comment[]`, `commentsExpanded: boolean`, `commentsCursor: string | null`, `hasMoreComments: boolean`), new `loadComments(spotId)` / `renderCommentsSection()` methods mirroring `loadParking()`/`renderParking()`, called at the end of `loadInfo()`. Click handlers for expand/post/delete/reply/load-older bound directly in `SpotPanel` (matching how `.spot-like-btn` is handled there via `handleLike()`), not in the stateless `logic.ts`.
- **One small addition:** `IAuthService.getUser()` currently has no way to signal admin/trailcrew status, which the popup needs to decide delete-button visibility (moderation decision: author + admin + trailcrew). Add optional `isAdmin?: boolean` / `isTrailcrew?: boolean` fields to `src/auth/user.ts`'s `User` class, populated in the Nuxt `authAdapter.authService.getUser()` (`useTrailMap.ts`) from `authStore.isAdmin`/`authStore.isTrailcrew` (already-existing computeds). This is a coarse, non-per-spot check — it only drives whether the delete icon *renders*; the actual authorization is `can_edit_spot` in RLS, so a trailcrew member assigned to a different spot would see the icon but get a harmless failed-delete error on click (rare edge case, not worth a per-spot client-side check). No other `IAuthService` changes; fields are optional so nothing else breaks.

**Behavior (unchanged from original decisions):**
- **Collapsed by default:** shows `💬 12 comments` as a clickable toggle.
- **Expanded:** reveals the list (newest first, latest 20), each row showing avatar, display name, timestamp, and text.
  - A "Reply" link on each comment prefills the compose textarea with `@display_name `.
  - A delete (×) icon appears for the comment's own author, or when the current user's `isAdmin`/`isTrailcrew` flag is set (client-side visibility only — RLS is the real gate).
- **"Load older"** button below the list, calling `getOlderComments`, shown when the last fetch returned a full page of 20.
- **Write box:** if `auth.authService.loggedIn`, a textarea + "Post" button with a 500-char counter (disabled when empty or over limit). If not logged in, a "log in to comment" prompt instead — mirrors the existing photo-upload login-gating convention in the same file.
- Posting calls `postComment(spotId, text, this.auth.authService)`, then prepends the new comment to `this.comments` and re-renders the section. Errors (rate limit, length) render inline under the textarea, not as a toast — matching the popup's tight-space form conventions.

## 4. Testing

**Unit tests (vitest):**
- `src/communication/comments.test.ts` — `getComments`, `getOlderComments`, `postComment`, `deleteComment` against a mocked HTTP boundary (never the production DB, per CLAUDE.md).
- `src/stores/auth.test.ts` — extend with `commentOnTrail`: throws when `user.value` is null; delegates correctly to `postComment` when logged in.
- **Accepted gap:** the rate-limit trigger and length CHECK constraint are Postgres-side and not exercised by vitest (no local Postgres in the unit test environment). Verified manually against the migration; not automated.

**E2E (Playwright)** — required per CLAUDE.md when touching map interaction or auth flow, both of which this feature touches:
- Anonymous user sees comments (read-only) and a login prompt instead of a write box.
- Logged-in user posts a comment and sees it appear in the list.
- Comment author sees a delete control on their own comment and can remove it.
- A second logged-in user does not see a delete control on someone else's comment.

**Error handling:**
- Rate-limit and length-constraint violations surface as thrown errors, shown inline under the compose textarea.
- Network/fetch failures on the comment list show a small inline retry state without breaking the rest of the popup (photos and spot details continue to render independently).

## Architecture impact

None. This follows the existing `communication/ → stores/ → map/` dependency layering exactly (`src/architecture.test.ts`, `.dependency-cruiser.cjs`) — no new cross-layer imports, no changes needed to either enforcement file.
