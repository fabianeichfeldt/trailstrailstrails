export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export let deferredInstallPrompt: BeforeInstallPromptEvent | null = null

export function setDeferredInstallPrompt(e: BeforeInstallPromptEvent | null) {
  deferredInstallPrompt = e
}
