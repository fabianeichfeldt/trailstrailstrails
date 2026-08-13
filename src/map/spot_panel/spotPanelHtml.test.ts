import { describe, it, expect } from 'vitest'
import { trailsHTML, trailStatusCardFor, commentsHTML, type CommentsHtmlOptions } from './spotPanelHtml'
import type { MtbTrail, MtbTour } from '../../types/MtbTypes'
import { Comment } from '../../types/Comment'

// parkingHTML() and its tests were removed here — superseded by the
// SpotPanelParkingTab.vue island (src/components/map/SpotPanelParkingTab.vue,
// tested in SpotPanelParkingTab.test.ts) as part of the spot-panel Vue
// migration, Phase 1 (see docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md).

function baseTrail(overrides: Partial<MtbTrail> = {}): MtbTrail {
  return {
    id: 't1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
    distance_km: 3, elevation_gain: 100, elevation_loss: 300,
    direction: 'one-way-down', gpxPoints: [], elevationProfile: [],
    ...overrides,
  }
}

describe('trailsHTML — status row tint + tag', () => {
  it('renders no status tint or tag for an open trail', () => {
    const html = trailsHTML([baseTrail()])
    expect(html).not.toContain('trail-status-row-')
    expect(html).not.toContain('trail-status-tag')
  })

  it('tints the row and tags "Gesperrt" for a trail with an active closed_from', () => {
    const html = trailsHTML([baseTrail({ closed_from: '2000-01-01T00:00:00Z' })])
    expect(html).toContain('trail-status-row-closed')
    expect(html).toContain('trail-status-tag-closed')
    expect(html).toContain('Gesperrt')
  })

  it('tints the row and tags "Hinweis" for a future closed_from', () => {
    const html = trailsHTML([baseTrail({ closed_from: '2999-01-01T00:00:00Z' })])
    expect(html).toContain('trail-status-row-hint')
    expect(html).toContain('trail-status-tag-hint')
    expect(html).toContain('Hinweis')
  })

  it('tints the row and tags "Hinweis" for a hint with no schedule', () => {
    const html = trailsHTML([baseTrail({ hint: 'Erdrutsch, bitte umfahren' })])
    expect(html).toContain('trail-status-row-hint')
    expect(html).toContain('trail-status-tag-hint')
  })

  it('renders no tint or tag once an expired schedule has passed', () => {
    const html = trailsHTML([baseTrail({ closed_from: '2000-01-01T00:00:00Z', closed_to: '2000-02-01T00:00:00Z' })])
    expect(html).not.toContain('trail-status-row-')
    expect(html).not.toContain('trail-status-tag')
  })
})

function baseTour(overrides: Partial<MtbTour> = {}): MtbTour {
  return {
    id: 'tr1', spotId: 's1', name: 'Testtour',
    distance_km: 5, elevation_gain: 200, elevation_loss: 400,
    direction: 'cw', duration_minutes: 60, trailCount: 2,
    segments: [], gpxPoints: [], elevationProfile: [], hasFullGpx: true,
    ...overrides,
  }
}

describe('trailStatusCardFor', () => {
  it('returns null for an open trail (nothing to show in the elevation view)', () => {
    expect(trailStatusCardFor(baseTrail(), 'Waldkopf')).toBeNull()
  })

  it('returns null for a tour, even one that happens to share a trail id (tours have no status fields)', () => {
    expect(trailStatusCardFor(baseTour(), 'Waldkopf')).toBeNull()
  })

  it('returns a closed status card with the state class and Trailcrew attribution for a closed trail', () => {
    const el = trailStatusCardFor(baseTrail({ closed_from: '2000-01-01T00:00:00Z' }), 'Waldkopf')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('trail-status-info-closed')
    expect(el!.textContent).toContain('Aktuell gesperrt')
    expect(el!.textContent).toContain('Hinweis von Trailcrew Waldkopf')
  })

  it('returns a closing-soon status card for a hint with no schedule', () => {
    const el = trailStatusCardFor(baseTrail({ hint: 'Erdrutsch, bitte umfahren' }), 'Waldkopf')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('trail-status-info-closing')
    expect(el!.textContent).toContain('Erdrutsch, bitte umfahren')
  })
})

function baseComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1, created_at: '2026-08-01T00:00:00Z', spot_id: 's1', user_id: 'u1',
    comment_text: 'Trail war heute top in Schuss!',
    profiles: { display_name: 'Alice', avatar_url: '' },
    ...overrides,
  }
}

function baseOpts(overrides: Partial<CommentsHtmlOptions> = {}): CommentsHtmlOptions {
  return {
    expanded: true, hasMore: false, loggedIn: true,
    currentUserId: 'u1', canModerate: false,
    ...overrides,
  }
}

describe('commentsHTML', () => {
  it('collapsed: shows only the count toggle, no list or write box', () => {
    const html = commentsHTML([baseComment()], baseOpts({ expanded: false }))
    expect(html).toContain('data-action="toggle-comments"')
    expect(html).toContain('1 Kommentar')
    expect(html).not.toContain('comments-list')
    expect(html).not.toContain('comments-write-box')
  })

  it('uses singular "Kommentar" for exactly one, plural "Kommentare" otherwise', () => {
    expect(commentsHTML([baseComment()], baseOpts({ expanded: false }))).toContain('1 Kommentar<')
    expect(commentsHTML([], baseOpts({ expanded: false }))).toContain('0 Kommentare')
    expect(commentsHTML([baseComment({ id: 1 }), baseComment({ id: 2 })], baseOpts({ expanded: false })))
      .toContain('2 Kommentare')
  })

  it('appends a "+" to the count when more comments exist than the loaded page', () => {
    const html = commentsHTML([baseComment()], baseOpts({ expanded: false, hasMore: true }))
    expect(html).toContain('1+ Kommentar')
  })

  it('shows an empty-state message when expanded with no comments', () => {
    const html = commentsHTML([], baseOpts())
    expect(html).toContain('Noch keine Kommentare')
  })

  it('expanded: renders author, date and text for each comment', () => {
    const html = commentsHTML([baseComment({ comment_text: 'Super Trail!' })], baseOpts())
    expect(html).toContain('Alice')
    expect(html).toContain('Super Trail!')
  })

  it('escapes HTML in comment text and author name (freeform user content, XSS risk)', () => {
    const html = commentsHTML([baseComment({
      comment_text: '<img src=x onerror=alert(1)>',
      profiles: { display_name: '<b>Mallory</b>', avatar_url: '' },
    })], baseOpts())
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<b>Mallory</b>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&lt;b&gt;Mallory&lt;/b&gt;')
  })

  it('shows a delete control for the comment author, even when not a moderator', () => {
    const html = commentsHTML([baseComment({ user_id: 'u1' })], baseOpts({ currentUserId: 'u1', canModerate: false }))
    expect(html).toContain('data-action="delete-comment"')
  })

  it('shows a delete control for a moderator on someone else\'s comment', () => {
    const html = commentsHTML([baseComment({ user_id: 'other' })], baseOpts({ currentUserId: 'u1', canModerate: true }))
    expect(html).toContain('data-action="delete-comment"')
  })

  it('hides the delete control for a non-author, non-moderator viewer', () => {
    const html = commentsHTML([baseComment({ user_id: 'other' })], baseOpts({ currentUserId: 'u1', canModerate: false }))
    expect(html).not.toContain('data-action="delete-comment"')
  })

  it('shows "load older" only when expanded and hasMore is true', () => {
    expect(commentsHTML([baseComment()], baseOpts({ hasMore: true }))).toContain('data-action="load-more-comments"')
    expect(commentsHTML([baseComment()], baseOpts({ hasMore: false }))).not.toContain('data-action="load-more-comments"')
  })

  it('shows the write box when logged in, and a login prompt otherwise', () => {
    const loggedIn = commentsHTML([], baseOpts({ loggedIn: true }))
    expect(loggedIn).toContain('data-action="post-comment"')
    expect(loggedIn).not.toContain('data-action="login-comments"')

    const anon = commentsHTML([], baseOpts({ loggedIn: false }))
    expect(anon).toContain('data-action="login-comments"')
    expect(anon).not.toContain('data-action="post-comment"')
  })
})
