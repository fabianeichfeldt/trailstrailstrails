# Implementation plan: role-based photo deletion

Date: 2026-09-28
Spec: `docs/superpowers/specs/2026-09-28-photo-deletion-design.md`

(No `writing-plans` skill is installed in this environment — written directly,
same structure/intent: concrete steps, file-by-file, tests named up front.)

## Before starting

Already in the correct worktree (`worktree-feat-photo-deletion`, at
`.claude/worktrees/feat-photo-deletion`) with the spec committed as the
first commit on this branch. Every step below happens in this worktree.
Commit at the end of each step (small, reviewable commits), per CLAUDE.md.

Run `npm test` after every step that touches `app/` — don't wait until the
end to discover a break.

---

## Step 1 — Migration: RLS delete policies

New file: `supabase/migrations/20260928120000_add_trail_photo_delete_policies.sql`

```sql
-- Photo deletion: owner, admin, or trailcrew assigned to the spot.
-- Mirrors the spot_comments delete policy (20260811120000_add_spot_comments.sql),
-- reusing can_edit_spot() — no new authorization logic.

CREATE POLICY "delete own or moderated photo" ON "public"."trail_photos"
  FOR DELETE TO authenticated
  USING (auth.uid() = creator OR can_edit_spot(trail_id));

-- The trail-photos storage bucket has no delete policy at all today (only
-- insert). owner_id is set automatically by Supabase Storage to the
-- uploader's auth.uid() at upload time. storage.foldername(name))[1] is the
-- trailId segment of the "{trailId}/{uuid}.webp" object path set by
-- uploadTrailPhoto() in app/communication/photos.ts. lower(...) mirrors the
-- existing gpx-files delete policy's defensive casing guard.
CREATE POLICY "delete own or moderated trail photo" ON "storage"."objects"
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'trail-photos'
    AND (
      owner_id = (auth.uid())::text
      OR can_edit_spot(lower((storage.foldername(name))[1]))
    )
  );
```

No `GRANT` statements needed (see spec §1). No test — this is schema, not
application code, same accepted gap as `spot_comments`'s rate-limit trigger.

**This migration is not applied by Claude.** Per CLAUDE.md's Supabase rules,
the user applies it via the Supabase CLI themselves. Flag this clearly when
handing off — until it's applied, delete calls from the app will get 0 rows
back from `trail_photos` (RLS blocks everything, since no DELETE policy
exists yet) and the new `photos.test.ts` "throws when 0 rows come back"
test is exactly the safety net for that state.

**Commit:** "Add RLS delete policies for trail photos"

---

## Step 2 — Communication layer: `app/communication/photos.ts`

Two new exports. `deletePhoto` follows this file's existing `SupabaseClient`
style (`uploadTrailPhoto`); `isSpotAssignedToTrailcrew` follows the
raw-REST + `IAuthService` style used by `comments.ts`'s `deleteComment`,
since it's a plain authenticated table read, not a Storage operation.

```typescript
import { REST, userHeaders } from './http'
import type { IAuthService } from '../auth/auth_service'

export async function deletePhoto(
  photo: { id: string | number; url: string },
  client: SupabaseClient,
): Promise<void> {
  const { data, error } = await client
    .from('trail_photos')
    .delete()
    .eq('id', photo.id)
    .select('id')
  if (error) throw new Error('Photo delete failed')
  if (!data || data.length === 0) throw new Error('Photo delete failed: not permitted')

  const path = photo.url.split('/trail-photos/')[1]
  if (!path) return
  const { error: storageError } = await client.storage.from('trail-photos').remove([path])
  if (storageError) throw new Error('Photo file delete failed')
}

export async function isSpotAssignedToTrailcrew(spotId: string, authService: IAuthService): Promise<boolean> {
  const user = await authService.getUser()
  const res = await fetch(
    `${REST}/trailcrew_spots?select=spot_id&user_id=eq.${user.id}&spot_id=eq.${spotId}&limit=1`,
    { method: 'GET', cache: 'no-store', headers: userHeaders(user.accessToken) },
  )
  if (!res.ok) return false
  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0
}
```

(`import type { SupabaseClient } from '@supabase/supabase-js'` already exists
at the top of this file for `uploadTrailPhoto`.)

**New test file: `app/communication/photos.test.ts`** (none exists today —
`uploadTrailPhoto` currently has zero direct unit coverage; this file fixes
that gap for the new code, doesn't need to backfill upload coverage too).

Build a minimal fake `SupabaseClient` for `deletePhoto` tests:

```typescript
function fakeClient(opts: { deleteData?: unknown[] | null; deleteError?: unknown; removeError?: unknown } = {}) {
  const select = vi.fn().mockResolvedValue({ data: opts.deleteData ?? [{ id: 1 }], error: opts.deleteError ?? null })
  const eq = vi.fn(() => ({ select }))
  const del = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ delete: del }))
  const remove = vi.fn().mockResolvedValue({ error: opts.removeError ?? null })
  const storage = { from: vi.fn(() => ({ remove })) }
  return { client: { from, storage } as any, del, eq, select, remove }
}
```

Cases to cover:
- Happy path: row delete succeeds (non-empty data), storage `remove()` is
  called with the path parsed out of the URL after `/trail-photos/`.
- Row delete returns `error` → throws, storage `remove()` never called.
- Row delete succeeds but returns an **empty array** (the RLS-blocked case —
  PostgREST reports this as success, not an error) → throws, storage
  `remove()` never called. This is the case that matters most: it's the only
  thing standing between a silently-blocked delete and a false "deleted"
  toast in the UI.
- Row delete succeeds, but the URL has no `/trail-photos/` segment (malformed
  data) → resolves without calling `storage.remove()` (no throw).
- Storage `remove()` errors after a successful row delete → throws.

For `isSpotAssignedToTrailcrew`, mock `global.fetch` same as
`comments.test.ts` does:
- Returns `true` when the REST call comes back with one row.
- Returns `false` when it comes back with an empty array.
- Returns `false` (not a throw) when the fetch response is `!ok` — this
  check only gates a UI affordance, a transient network failure should fail
  closed (hide the delete button), not crash the page.
- Sends the request with `Authorization: Bearer <accessToken>` from
  `authService.getUser()`.

**Commit:** "Add photo delete + trailcrew-assignment check to communication layer"

---

## Step 3 — `app/types/Photo.ts`: add `creator`

```typescript
export class Photo {
    id: string = "";
    url: string = "";
    created_at: string = "";
    creator: string = "";
    profiles: {
      display_name: string
      avatar_url: string
    } = {display_name: "", avatar_url: ""};
}
```

No backend change needed — the `trail-details` edge function
(`trailradar-backend` repo) already does `select("*, profiles(...))")`, so
`creator` is already in the live payload; only the TS type was missing it.

No dedicated test for a one-field type addition, but Step 8's component
tests exercise it via fixture photos that set `creator`.

**Commit:** "Add creator field to Photo type"

---

## Step 4 — `app/utils/canDeletePhoto.ts`: pure permission helper

Extracted as a standalone pure function (not inlined in a `.vue` `<script>`)
specifically so it's directly unit-testable without mounting a component —
every other file in `app/utils/` follows this same one-function-plus-test
shape.

```typescript
export interface PhotoPermissionContext {
  userId: string
  isAdmin: boolean
  photosCanModerate: boolean
}

export function canDeletePhoto(photo: { creator?: string }, ctx: PhotoPermissionContext): boolean {
  return !!photo.creator && (photo.creator === ctx.userId || ctx.isAdmin || ctx.photosCanModerate)
}
```

(The `!!photo.creator` guard matters: on first paint the prerendered/baked
photo payload has no `creator` field at all — see spec §3 — so the button
must stay hidden until live data with `creator` has loaded, not show for
everyone because `undefined === undefined`.)

**New test file: `app/utils/canDeletePhoto.test.ts`**
- `true` when `photo.creator === ctx.userId`.
- `true` when `ctx.isAdmin`, regardless of `creator`/`userId`.
- `true` when `ctx.photosCanModerate`, regardless of `creator`/`userId`.
- `false` when none of the three apply.
- `false` when `photo.creator` is missing/empty, even if `ctx.userId` is
  also empty (the "logged out, both blank, don't accidentally match" case).

**Commit:** "Add canDeletePhoto permission helper"

---

## Step 5 — `app/stores/auth.ts`: `deleteTrailPhoto` wrapper

Same shape as the existing `uploadTrailPhoto` wrapper (`auth.ts:163-166`):

```typescript
import { uploadTrailPhoto as uploadTrailPhotoImpl, deletePhoto as deletePhotoImpl } from '~/communication/photos'
// ...
async function deleteTrailPhoto(photo: { id: string | number; url: string }): Promise<void> {
  if (!user.value) throw new Error('Not logged in')
  return deletePhotoImpl(photo, client)
}
```

Add `deleteTrailPhoto` to the store's returned object, next to `uploadTrailPhoto`.

**Extend `app/stores/auth.test.ts`** (it already
`vi.mock('~/communication/photos', () => ({ uploadTrailPhoto: vi.fn() }))` —
add `deletePhoto: vi.fn()` to that mock):
- Throws `'Not logged in'` when `user.value` is null, without calling `deletePhotoImpl`.
- Delegates to `deletePhotoImpl(photo, client)` when logged in.

**Commit:** "Add deleteTrailPhoto to auth store"

---

## Step 6 — `app/stores/spotPanel.ts`: `photosCanModerate`

```typescript
import { isSpotAssignedToTrailcrew } from '~/communication/photos'
// ...
const photosCanModerate = ref(false)

async function loadPhotoModeration(spotId: string, authInfo: CommentsAuthInfo, authService: IAuthService) {
  if (authInfo.isAdmin) {
    photosCanModerate.value = true
    return
  }
  if (!authInfo.isTrailcrew) {
    photosCanModerate.value = false
    return
  }
  try {
    photosCanModerate.value = await isSpotAssignedToTrailcrew(spotId, authService)
  } catch (err) {
    console.warn('Failed to check trailcrew spot assignment:', err)
    photosCanModerate.value = false
  }
}
```

Reuses the existing `CommentsAuthInfo` interface for the `isAdmin`/`isTrailcrew`
flags (its `userId` field is simply unused here) rather than introducing a
parallel type, since call sites already build one of these for `loadComments`.

Reset `photosCanModerate.value = false` in `load()` alongside the other
per-spot state resets (`comments.value = []`, etc.), and add it to the
store's returned object along with `loadPhotoModeration`.

**Extend `app/stores/spotPanel.test.ts`** (mirrors the existing `loadComments`
describe block; mock `isSpotAssignedToTrailcrew` from `~/communication/photos`
the same way `getComments` is already mocked from `~/communication/comments`):
- Admin → `photosCanModerate` is `true` immediately, `isSpotAssignedToTrailcrew`
  is **not called** (no query needed for admin — matches spec §3).
- Non-admin, non-trailcrew (plain user) → `false`, not called.
- Trailcrew, `isSpotAssignedToTrailcrew` resolves `true` → `true`.
- Trailcrew, resolves `false` → `false`.
- Trailcrew, `isSpotAssignedToTrailcrew` throws → `false` (fails closed,
  doesn't propagate/crash the caller).

**Commit:** "Add precise trailcrew photo-moderation check to spotPanel store"

---

## Step 7 — `app/pages/trails/[slug].vue`: wire it up

1. Add a local `authServiceAdapter(): IAuthService` function, same shape as
   the one already duplicated in `SpotDetailHero.vue`/`SpotPanelComments.vue`
   (`app/components/trail_detail/SpotDetailHero.vue:63-75`) — this file
   doesn't have one yet.
2. Extend `loadLiveSpotData()`:

```typescript
function loadLiveSpotData(item: Trail) {
  spotPanelStore.load(item)
  const authInfo = { userId: authStore.userId, isAdmin: authStore.isAdmin, isTrailcrew: authStore.isTrailcrew }
  spotPanelStore.loadComments(item.id, authInfo)
  spotPanelStore.loadPhotoModeration(item.id, authInfo, authServiceAdapter())
}
```

3. Add a handler for the new `photo-deleted` event from `SpotDetailPhotos`,
   splicing the removed photo out of the page-owned `details` ref:

```typescript
function onPhotoDeleted(id: string) {
  details.value.photos = details.value.photos.filter(p => p.id !== id)
}
```

4. Wire it on the existing `<SpotDetailPhotos>` usage:

```html
<SpotDetailPhotos
  :trail="trailForStore"
  :details="details"
  @uploaded="refreshDetails"
  @photo-deleted="onPhotoDeleted"
/>
```

No new test file for this page-level wiring — covered indirectly by Step 8's
component test (which asserts the emit) and the E2E spec in Step 10 (which
asserts the end-to-end behavior through the real page). Adding a full page
mount test here would duplicate both without adding signal.

**Commit:** "Wire photo moderation + delete handling into the spot-detail page"

---

## Step 8 — `app/components/trail_detail/SpotDetailPhotos.vue`: delete UI

Template: add a trash button inside each `.photo-wrap`, visible only when
`canDeletePhoto(p, permissionCtx)`:

```html
<button
  v-if="canDeletePhoto(p, permissionCtx)"
  class="photo-delete-btn"
  aria-label="Foto löschen"
  @click.stop="removePhoto(p)"
>
  <i class="fa-solid fa-trash"></i>
</button>
```

Script additions:

```typescript
import { confirmDialog } from '~/map/confirmDialog'
import { canDeletePhoto } from '~/utils/canDeletePhoto'

const emit = defineEmits<{ uploaded: []; 'photo-deleted': [id: string] }>()

const spotPanelStore = useSpotPanelStore()

const permissionCtx = computed(() => ({
  userId: authStore.userId,
  isAdmin: authStore.isAdmin,
  photosCanModerate: spotPanelStore.photosCanModerate,
}))

async function removePhoto(photo: Photo) {
  const confirmed = await confirmDialog('Foto wirklich löschen?')
  if (!confirmed) return
  try {
    await authStore.deleteTrailPhoto(photo)
    emit('photo-deleted', photo.id)
    showToast('🗑️ Foto gelöscht')
  } catch (err) {
    console.error('Failed to delete photo:', err)
    showToast('Löschen fehlgeschlagen 😢')
  }
}
```

(`Photo` type import already needed — add `import type { Photo } from '~/types/Photo'`
if not already present.) The existing `watch(() => props.details.photos, ...)`
already resets `activePhoto.value = 0` on any array change, so removing a
photo (which changes `props.details.photos` via the parent's splice in Step 7)
needs no extra carousel-index handling.

**Extend `app/components/trail_detail/SpotDetailPhotos.test.ts`**. It already
stubs `useAuthStore`/`useMapStore` globally — add a `fakeSpotPanelStore:
{ photosCanModerate: boolean }` and `vi.stubGlobal('useSpotPanelStore', () =>
fakeSpotPanelStore)`, and extend `fakeAuthStore` with `userId`, `isAdmin`,
`deleteTrailPhoto`. Also `vi.mock('~/map/confirmDialog', () => ({
confirmDialog: vi.fn() }))`.

New cases (add photos with a `creator` field to the `details({ photos: [...] })`
fixture in each):
- Delete button visible when `photo.creator === fakeAuthStore.userId`.
- Delete button visible when `fakeAuthStore.isAdmin` is true, regardless of creator.
- Delete button visible when `fakeSpotPanelStore.photosCanModerate` is true, regardless of creator.
- Delete button **not** visible for an unrelated logged-in user (none of the three apply).
- Clicking delete, confirming (`confirmDialog` mock resolves `true`), calls
  `authStore.deleteTrailPhoto` with the photo and emits `photo-deleted` with its id.
- Clicking delete, cancelling (`confirmDialog` mock resolves `false`), does
  **not** call `deleteTrailPhoto` and does **not** emit.
- `deleteTrailPhoto` rejecting → no `photo-deleted` emit, error toast shown
  (assert via the mocked `showToast`), component doesn't throw.

**Commit:** "Add photo delete UI to spot-detail photo carousel"

---

## Step 9 — `app/pages/profile.vue`: delete from "Hochgeladene Fotos"

This list is always the viewer's own photos (`eq('creator', uid)`), so no
permission branching — every card gets a delete button unconditionally.

1. Add `id` to the select and to `PhotoItem`/the inline cast type:

```typescript
interface PhotoItem { id: string; url: string; created_at: string; trailName: string; trailID: string }
// ...
client.from('trail_photos').select('id, url, created_at, trail_id, trails(name)').eq('creator', uid),
// ...
photos.value = ((photosRes.data ?? []) as { id: string; url: string; created_at: string; trail_id: string; trails: { name: string } }[])
  .map(p => ({ id: p.id, url: p.url, created_at: p.created_at, trailName: p.trails.name, trailID: p.trail_id }))
```

2. Template: add a delete button per `.photo-card`:

```html
<div v-for="photo in photos" :key="photo.url" class="photo-card">
  <img :src="photo.url" :alt="photo.trailName" />
  <button class="photo-delete-btn" aria-label="Foto löschen" @click="removePhoto(photo)">
    <i class="fa-solid fa-trash"></i>
  </button>
  <div class="photo-meta">
    <span>{{ photo.trailName }}</span>
    <span>{{ formatDate(photo.created_at) }}</span>
  </div>
</div>
```

3. Script:

```typescript
import { confirmDialog } from '~/map/confirmDialog'
import { showToast } from '~/utils/toast'

async function removePhoto(photo: PhotoItem) {
  const confirmed = await confirmDialog('Foto wirklich löschen?')
  if (!confirmed) return
  try {
    await authStore.deleteTrailPhoto(photo)
    photos.value = photos.value.filter(p => p.id !== photo.id)
    showToast('🗑️ Foto gelöscht')
  } catch (err) {
    console.error('Failed to delete photo:', err)
    showToast('Löschen fehlgeschlagen 😢')
  }
}
```

**Testing:** check whether `app/pages/profile.vue` has an existing test file
(`app/pages/profile.test.ts` or similar) before writing a new one — extend
it if present, following the same mock-`confirmDialog`/mock-`authStore`
pattern as Step 8, covering: delete button present per photo card, confirm
→ calls `deleteTrailPhoto` and removes from the list, cancel → no-op, reject
→ error toast and item stays in the list. If no test file exists for this
page today, add one scoped to just the photos section (mount the page,
seed `photos.value`, don't attempt to cover the rest of the profile page).

**Commit:** "Add photo delete to profile page photo list"

---

## Step 10 — E2E (Playwright)

Per CLAUDE.md, required because this touches auth flow. Check
`tests/*.spec.ts` for an existing spot-detail-page or photo-upload spec to
extend (search for `photo-upload` / `trails/` specs) before creating a new
file; if one exists, add cases there — otherwise new file
`tests/photo-deletion.spec.ts`.

Cases (per spec §5 — these need seeded test users with each role: a regular
user, a trailcrew user assigned to one spot, a trailcrew user *not* assigned
to that spot, and an admin — check `tests/fixtures.ts` / existing E2E specs
for how role-seeded test accounts are already set up, e.g. in the SpotManager
E2E specs, and reuse that setup rather than inventing a new one):

1. Photo owner sees a delete control on their own photo on the spot-detail
   page and can remove it; the photo disappears from the carousel.
2. A different logged-in regular user does not see a delete control on
   someone else's photo.
3. A trailcrew member assigned to the spot sees and can use the delete
   control on any photo there (not just their own).
4. A trailcrew member **not** assigned to the spot does not see a delete
   control there.
5. Admin sees and can use the delete control on any spot's photos.

These require the migration from Step 1 to actually be applied to whatever
Supabase project the E2E suite runs against — note this dependency inline in
the spec file if the E2E run can't apply migrations itself.

**Commit:** "Add E2E coverage for role-based photo deletion"

---

## Step 11 — Final verification

- `npm test` — full unit suite green, including all new/extended test files above.
- `npm run lint:arch` — confirms no new layering violations (there shouldn't
  be any: `photos.ts` stays in `communication/`, stores stay `communication/`-only,
  components only import stores/communication, nothing reaches into `app/map/`).
- `npm run test:e2e` — run at least the new/extended spec from Step 10 (full
  suite if time allows).
- Manual note for the user (not automatable here): apply the Step 1 migration
  to the dev Supabase project and confirm both RLS policies actually block/allow
  as designed before merging — per the spec's "Manual/deploy-time verification" section.

**Commit (if anything changed during verification):** fix-up commits as needed.

---

## Explicitly out of scope (per spec)

Don't add: SpotManager bulk photo moderation, notifications to the uploader
on moderated deletion, soft-delete/undo, any change to the existing
(coarse) comment-moderation visibility check.
