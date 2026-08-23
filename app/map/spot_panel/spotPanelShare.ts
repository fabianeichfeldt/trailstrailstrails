// Pure share-decision logic, extracted from SpotPanel so it can be unit
// tested without a Leaflet map instance. All browser APIs are injected —
// see handleShare() in spotPanel.ts for the real navigator.share/clipboard
// wiring.

export interface ShareableItem {
  id: string;
  name: string;
}

export interface ShareDeps {
  hasNativeShare: boolean;
  nativeShare: (data: { title: string; url: string }) => Promise<void>;
  copyToClipboard: (text: string) => Promise<boolean>;
  showToast: (message: string, type?: string) => void;
  reportShare: (id: string) => Promise<void>;
}

export function trailShareUrl(id: string): string {
  return `https://trailradar.org/trails/${id}`;
}

// Firefox desktop does not implement navigator.share at all (Android-only,
// and only since Firefox 92), so it silently throws there. Chrome and Safari
// support it everywhere. copyToClipboard() is the fallback for any browser
// missing the native share sheet.
export async function shareTrail(item: ShareableItem, deps: ShareDeps): Promise<void> {
  const url = trailShareUrl(item.id);

  if (deps.hasNativeShare) {
    try {
      await deps.nativeShare({
        title: `Offizieller MTB Trail '${item.name}' auf Trailradar`,
        url,
      });
    } catch {
      // user cancelled the native share sheet
      return;
    }
    await deps.reportShare(item.id);
    return;
  }

  const copied = await deps.copyToClipboard(url);
  if (copied) {
    deps.showToast('Link kopiert!');
    await deps.reportShare(item.id);
  } else {
    deps.showToast('Teilen nicht möglich.', 'error');
  }
}
