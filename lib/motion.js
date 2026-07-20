'use client'

/**
 * The Aurora Glass motion vocabulary — one spring, a few reusable variants, so
 * every page moves with the same physics instead of ad-hoc durations. Import
 * these rather than hand-rolling transitions; that consistency is what makes the
 * portal feel authored rather than assembled.
 */

// The house spring — confident, a touch of overshoot, never bouncy.
export const spring = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }
export const springSoft = { type: 'spring', stiffness: 180, damping: 26 }

// A container that reveals its children in a stagger.
export const stagger = (delayChildren = 0.04, stagger = 0.055) => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren: stagger } },
})

// The atom most cards/rows use: rise + fade on entrance.
export const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring },
}

export const riseSm = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: springSoft },
}

// Scale-in for badges, chips, popovers.
export const pop = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring },
}

// Page-level fade for route content.
export const pageFade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}
