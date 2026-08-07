import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement matchMedia — framer-motion (reduced-motion checks) and
// any `prefers-color-scheme` / theme CSS queries in the app need it stubbed.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated but some libs still call it
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom doesn't implement IntersectionObserver — framer-motion's viewport/whileInView
// features probe for it.
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  window.IntersectionObserver = MockIntersectionObserver
  globalThis.IntersectionObserver = MockIntersectionObserver
}

// jsdom doesn't implement ResizeObserver — framer-motion's layout animations probe
// for it.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver
  globalThis.ResizeObserver = MockResizeObserver
}
