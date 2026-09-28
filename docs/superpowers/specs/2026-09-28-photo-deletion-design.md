# Photo Deletion — Design Spec

**Date:** 2026-09-28
**Status:** Implemented; one post-deploy fix applied (see below)

**Correction after real-world verification (2026-09-28):** on first live test, an admin delete returned HTTP 200 but the app reported "not permitted." Root cause: Postgres RLS filters the `RETURNING` output of a `DELETE` through the table's `SELECT` policies, not just the `DELETE` policy that authorized the write. `trail_photos`'s only `SELECT` policy was scoped `TO anon` (pre-existing, `20260514075528_remote_schema.sql`) — there was none for `authenticated`. So every authenticated delete actually succeeded at the row level, but `deletePhoto()`'s `.select('id')` came back empty (no rows visible to `RETURNING` under an `authenticated` session), which `deletePhoto()` correctly-by-design treats as "not permitted," and the storage-object cleanup step (gated behind that check) never ran. Fixed by `supabase/migrations/20260928130000_fix_trail_photo_delete_returning.sql`, widening the existing "get" policy to `TO anon, authenticated` — safe because that policy is `USING (true)` (unconditionally public) already, so this changes nothing about what data is exposed, only which sessions can see it via `RETURNING`. No application code changed; `deletePhoto()`'s empty-RETURNING-means-throw check is still correct in principle, it just needed the SELECT policy gap closed to stop false-triggering on legitimate deletes.

## Purpose

Let a `trail_photos` row be removed by three kinds of actor: an admin (any photo), a trailcrew member (any photo on a spot they're assigned to via `trailcrew_spots`), or the photo's own uploader (their own photo only). Today `trail_photos` has no DELETE policy at all — nobody can remove a photo short of a direct DB edit.

## Scope decisions

- **Hard delete** — the `trail_photos` row and its Supabase Storage object (`trail-photos` bucket) are both removed. No soft-delete, no audit trail, no undo.
- **No notification to the uploader** when an admin/trailcrew member removes their photo. No notification system exists in the app today; out of scope.
- **No bulk/moderation view in SpotManager.** Deletion happens inline wherever a photo is already shown (the spot-detail carousel, the profile page). SpotManager is untouched.
- **Trailcrew visibility is precise, not coarse.** The existing comment-delete button (`SpotPanelComments.vue`) shows for *any* trailcrew member on *any* spot and relies entirely on the server to reject unauthorized clicks. For photos we instead check the viewer's actual `trailcrew_spots` assignment for the spot being viewed before showing the delete control. The comments behavior is left as-is — fixing it is not part of this request.
- **Activity feed:** no code change needed. `activity.ts` queries `trail_photos` rows live (`app/communication/activity.ts:31`), so a deleted photo simply stops appearing — no join table to clean up.
- **Only the trail-photos path is touched.** Bike parks and dirt parks currently have no photo feature (`trail_photos.trail_id` is only ever populated for trails; the `bike-parks-details`/`dirt-parks-details` edge functions don't select from `trail_photos`), so this spec doesn't add anything there.

## 1. Data model / RLS

No schema change (no new columns/tables) — only new RLS policies, added in a new migration file `supabase/migrations/20260928120000_add_trail_photo_delete_policies.sql`.

### `trail_photos` DELETE policy

Mirrors the existing `spot_comments` delete policy exactly (`auth.uid() = user_id OR can_edit_spot(spot_id)`, `supabase/migrations/20260811120000_add_spot_comments.sql:26`), reusing `can_edit_spot()` so no new authorization logic is introduced:

```sql
CREATE POLICY "delete own or moderated photo" ON "public"."trail_photos"
  FOR DELETE TO authenticated
  USING (auth.uid() = creator OR can_edit_spot(trail_id));
```

(`trail_photos.trail_id` is already `text`, and `can_edit_spot(p_spot_id text)` takes `text` — no cast needed, same as the `spot_comments` policy.)

### `storage.objects` DELETE policy (new — the bucket has none today)

The `trail-photos` bucket currently only has an INSERT policy (`supabase/migrations/20260514075528_remote_schema.sql:1655-1657`, `with check (bucket_id = 'trail-photos')`). Deleting the DB row without this leaves an orphaned file in storage. New policy, modeled on the existing `gpx-files` delete policy's use of `storage.foldername()` to recover the spot id from the object path (`{trailId}/{uuid}.webp`, set in `uploadTrailPhoto()`), and on the existing avatars policy's use of `owner_id`:

```sql
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

`owner_id` is set automatically by Supabase Storage to the uploader's `auth.uid()` at upload time — no extra bookkeeping needed to know who owns a given object.

No `GRANT` statements needed: `trail_photos` already has `GRANT ALL ... TO authenticated` (`supabase/migrations/20260514075528_remote_schema.sql:1388`), and `storage.objects` grants are already broad enough for the other bucket policies to work without their own grants (see `gpx-files`/`avatars` policies, which add none either). RLS is the only gate.

## 2. Communication layer (`app/communication/photos.ts`)

`uploadTrailPhoto()` already takes a `SupabaseClient` directly (not the raw-REST `communication/` style `comments.ts`/`trails.ts` use) — new code stays consistent with that existing file's style rather than switching patterns:

```ts
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
```

The `.select('id')` + empty-result check exists so a delete silently blocked by RLS (0 rows affected, which PostgREST reports as a *success* with an empty array, not an error) surfaces as a thrown error instead of a false-positive "deleted" toast in the UI. This matters more here than it did for comments because two independent client-side visibility checks (ownership, and the new precise trailcrew-assignment check in §3) both need to stay correct for the button to only show when the delete will actually succeed — this is the backstop if either one is ever wrong or stale.

Thin wrapper added to `stores/auth.ts`, same shape as the existing `uploadTrailPhoto()` wrapper there:

```ts
async function deleteTrailPhoto(photo: { id: string | number; url: string }): Promise<void> {
  if (!user.value) throw new Error('Not logged in')
  return deletePhotoImpl(photo, client)
}
```

## 3. Knowing who uploaded a photo, and precise trailcrew visibility

**`creator` field:** the live detail-page fetch already returns it — the `trail-details` edge function (`trailradar-backend` repo, `supabase/functions/trail-details/get.ts:58-60`) does `select("*, profiles(display_name, avatar_url)")` on `trail_photos`, so `creator` is already in the payload today. Only the TypeScript type is missing it: add `creator: string` to `app/types/Photo.ts`. No backend repo change needed.

The prerendered/baked payload (`getTrailById()`/`getTrailBySlug()` in `app/communication/trails.ts`, used to seed the SSG page before hydration) only selects `id,url` and won't carry `creator` on first paint — same as `profiles`/`created_at` today, which `SpotDetailPhotos.vue` already tolerates being empty until the post-mount `refreshDetails()` call lands. The delete button follows the same rule: it only appears once live data (with `creator`) has loaded, exactly like the uploader name already does.

**Precise trailcrew check:** `spotPanel.ts` gets a new ref, `photosCanModerate`, set when the routed detail page (`trails/[slug].vue`) calls the store's existing `loadComments()`-adjacent load step. Concretely, extend `loadLiveSpotData()` in `trails/[slug].vue`:

```ts
function loadLiveSpotData(item: Trail) {
  spotPanelStore.load(item)
  spotPanelStore.loadComments(item.id, {
    userId: authStore.userId,
    isAdmin: authStore.isAdmin,
    isTrailcrew: authStore.isTrailcrew,
  })
  spotPanelStore.loadPhotoModeration(item.id, {
    userId: authStore.userId,
    isAdmin: authStore.isAdmin,
    isTrailcrew: authStore.isTrailcrew,
  }, client)
}
```

New store function:

```ts
async function loadPhotoModeration(spotId: string, authInfo: CommentsAuthInfo, client: SupabaseClient) {
  if (authInfo.isAdmin) { photosCanModerate.value = true; return }
  if (!authInfo.isTrailcrew) { photosCanModerate.value = false; return }
  const { data } = await client
    .from('trailcrew_spots')
    .select('spot_id')
    .eq('user_id', authInfo.userId)
    .eq('spot_id', spotId)
  photosCanModerate.value = !!data && data.length > 0
}
```

This relies on the existing "trailcrew reads own" RLS policy on `trailcrew_spots` (`user_id = auth.uid()`, `supabase/migrations/20260514075528_remote_schema.sql:988`) — the same one `spot_manager/Api.ts`'s `getManageableSpots()` already depends on — so no new RLS is needed for this query. `spotPanel.ts` needs a `SupabaseClient` for this one query; it's passed in by the caller (same as `IAuthService` is passed into `deleteComment()`) rather than imported into the store, keeping the store's existing "no Leaflet/client imports of its own" boundary.

A photo's delete button, wherever it's rendered, uses:

```ts
function canDeletePhoto(photo: Photo): boolean {
  return photo.creator === authStore.userId || authStore.isAdmin || spotPanelStore.photosCanModerate
}
```

## 4. UI

### `SpotDetailPhotos.vue` (carousel on `trails/[slug]`)

A small trash-icon button (`fa-solid fa-trash`, same icon `SpotPanelComments.vue` uses) added to each `.photo-wrap`, shown per `canDeletePhoto(photo)` above. Click flow, mirroring `SpotPanelComments.vue`'s `remove()`:

```ts
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

New `photo-deleted: [id: string]` emit. Parent (`trails/[slug].vue`) handles it by splicing `details.value.photos`:

```ts
function onPhotoDeleted(id: string) {
  details.value.photos = details.value.photos.filter(p => p.id !== id)
}
```

`SpotDetailPhotos.vue` already owns `activePhoto` (the carousel index) internally and has an existing `watch(() => props.details.photos, ...)` that resets `activePhoto.value = 0` on any change to the photos array — removing an item naturally re-triggers that watcher, so no extra index-clamping logic is needed beyond what's already there.

### `profile.vue` ("Hochgeladene Fotos")

This list is always the viewer's own photos (`eq('creator', uid)`), so no permission branching — every card gets a delete button. Two small changes:
- Add `id` to the existing select (`client.from('trail_photos').select('url, created_at, trail_id, trails(name)')` → add `id`) and to the local `PhotoItem` interface — needed by `deletePhoto()`/`deleteTrailPhoto()`, not currently fetched here.
- Delete icon per `.photo-card`, same `confirmDialog()` → `authStore.deleteTrailPhoto()` → splice from `photos.value` → `showToast()` flow as above.

## 5. Testing

**Unit tests (vitest):**
- `app/communication/photos.test.ts` (new file — none exists today): `deletePhoto()` deletes the row via the mocked `SupabaseClient`, then removes the derived storage path; throws when the row delete errors; throws when the row delete succeeds but returns zero rows (RLS-blocked case); skips the storage removal gracefully if the URL doesn't contain `/trail-photos/`.
- `app/stores/auth.test.ts`: extend with `deleteTrailPhoto` — throws when `user.value` is null; delegates to `deletePhoto` with the client when logged in.
- `app/stores/spotPanel.test.ts`: extend with `loadPhotoModeration` — sets `photosCanModerate = true` immediately for admin (no query performed); queries `trailcrew_spots` and sets `true`/`false` based on result for trailcrew; sets `false` without querying for a plain user.
- Component-level (`SpotDetailPhotos.test.ts` if one exists, else add): delete button visibility for owner / admin / assigned trailcrew / unrelated trailcrew / anonymous viewer, using `canDeletePhoto()`'s three-way check directly rather than mocking the whole component tree.
- **Accepted gap:** the two new RLS policies (DB-level enforcement) aren't exercised by vitest — no local Postgres in the unit test environment. This is the same accepted gap the `spot_comments` migration documented for its rate-limit trigger; verify manually against the migration after it's applied.

**E2E (Playwright)** — required per CLAUDE.md (touches auth flow):
- Photo owner sees a delete control on their own photo and can remove it; the photo disappears from the carousel.
- A different logged-in regular user does not see a delete control on someone else's photo.
- A trailcrew member assigned to the spot sees and can use the delete control on any photo there (not just their own).
- A trailcrew member **not** assigned to the spot does not see a delete control there.
- Admin sees and can use the delete control on any spot's photos.

**Manual/deploy-time verification (not automatable in this repo):**
- Apply the new migration to a dev Supabase project and confirm both new RLS policies actually take effect (row-level DELETE on `trail_photos`, object-level DELETE on `storage.objects` for the `trail-photos` bucket) — per `npm run verify:static-build`'s spirit of catching things only a real backend can catch.

## Architecture impact

None. Follows the existing `communication/ → stores/ → composables/ → components/` layering exactly (`app/architecture.test.ts`, `.dependency-cruiser.cjs`) — `photos.ts` gains a function, `auth.ts`/`spotPanel.ts` gain thin wrappers, no new cross-layer imports. `app/types/database.types.ts` does not need regenerating — this change adds RLS policies, not columns or tables, which generated types don't reflect.
