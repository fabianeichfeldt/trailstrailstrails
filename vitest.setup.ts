// Nuxt injects `ref`/`watch`/`onMounted`/`onUnmounted`/`defineStore` (and many
// more) as build-time auto-imports — components and stores reference them as
// bare globals with no explicit `import` statement. There is no Nuxt runtime
// in vitest, so this setup file stubs the handful actually used by code under
// test as real `globalThis` bindings, matching what Nuxt's compiler would
// have inserted. It must run via `test.setupFiles` (not from within a test
// file) so the stubs exist before any `~/stores/*` module is imported —
// ES module imports are hoisted ahead of in-file statements.
import { vi } from 'vitest'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { defineStore } from 'pinia'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('defineStore', defineStore)
