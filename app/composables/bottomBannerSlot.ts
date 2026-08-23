import { ref } from 'vue'

// Only one bottom-sheet banner (PWA install, Android beta hint, ...) should be
// visible at a time. Each banner sets this true while shown and false when
// dismissed; a banner about to appear checks it first and skips this visit if
// another banner already has the slot.
export const bottomBannerActive = ref(false)
