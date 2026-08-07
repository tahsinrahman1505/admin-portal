/**
 * Barrel re-export for the 3-pane inbox redesign's presentational
 * components. All five take props and emit callbacks only — no data
 * fetching, no supabase, no realtime — so the caller (currently
 * app/(portal)/conversations/page.js, mid-rewrite) owns all state.
 */

export { default as FolderRail } from './FolderRail'
export { default as ThreadRow } from './ThreadRow'
export { default as MessageBubble } from './MessageBubble'
export { default as Composer } from './Composer'
export { default as PatientContext } from './PatientContext'
