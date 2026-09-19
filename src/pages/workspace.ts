import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { newBlockId } from '../editor/ids'
import { openNamedDoc, type LocalDoc } from '../editor/persist'

export const CATALOG_NAME = 'page-catalog'
export const LEGACY_DOC_NAME = 'local-page'

export type PageMeta = {
  id: string
  title: string
}

type TitleListener = (id: string, title: string) => void

const cache = new Map<string, LocalDoc>()
const titleListeners = new Set<TitleListener>()

let catalogDoc: Y.Doc | null = null
let catalogPersist: IndexeddbPersistence | null = null
let pagesMap: Y.Map<string> | null = null
let metaMap: Y.Map<string> | null = null
let homeId = ''
let navDepth = 0
let backInFlight = false

export function pageUrl(id: string) {
  return `#/p/${id}`
}

export function pageIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/p\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

export function getHomeId() {
  return homeId
}

export function getPageTitle(id: string) {
  return pagesMap?.get(id) || 'Untitled'
}

export function listPages(excludeId?: string): PageMeta[] {
  if (!pagesMap) return []
  const pages: PageMeta[] = []
  pagesMap.forEach((title, id) => {
    if (excludeId && id === excludeId) return
    pages.push({ id, title })
  })
  return pages.sort((a, b) => a.title.localeCompare(b.title))
}

export function filterPages(query: string, excludeId?: string): PageMeta[] {
  const pages = listPages(excludeId)
  const q = query.trim().toLowerCase()
  if (!q) return pages
  const starts = pages.filter((page) => page.title.toLowerCase().startsWith(q))
  const rest = pages.filter(
    (page) =>
      !page.title.toLowerCase().startsWith(q) && page.title.toLowerCase().includes(q),
  )
  return starts.concat(rest)
}

export function setPageTitle(id: string, title: string) {
  if (!pagesMap) return
  const next = title.trim() || 'Untitled'
  if (pagesMap.get(id) === next) return
  pagesMap.set(id, next)
}

export function watchPageTitle(fn: TitleListener) {
  titleListeners.add(fn)
  return () => titleListeners.delete(fn)
}

function emitTitles() {
  if (!pagesMap) return
  pagesMap.forEach((title, id) => {
    titleListeners.forEach((fn) => fn(id, title))
  })
}

export function createPage(title = 'Untitled'): PageMeta {
  if (!pagesMap) throw new Error('Page catalog is not open')
  const id = newBlockId()
  const name = title.trim() || 'Untitled'
  pagesMap.set(id, name)
  openPage(id)
  return { id, title: name }
}

export function openPage(id: string): LocalDoc {
  if (!pagesMap) throw new Error('Page catalog is not open')
  if (!pagesMap.has(id)) pagesMap.set(id, 'Untitled')
  const cached = cache.get(id)
  if (cached) return cached
  const title = pagesMap.get(id) || 'Untitled'
  const doc = openNamedDoc(`page-${id}`, title)
  cache.set(id, doc)
  return doc
}

export function replacePageUrl(id: string) {
  history.replaceState({ pageId: id }, '', pageUrl(id))
  navDepth = 0
}

export function pushPageUrl(id: string) {
  history.pushState({ pageId: id }, '', pageUrl(id))
  navDepth += 1
}

export function canGoBack() {
  return navDepth > 0
}

export function goBack() {
  if (navDepth < 1 || backInFlight) return false
  backInFlight = true
  history.back()
  return true
}

export function notePopState() {
  navDepth = Math.max(0, navDepth - 1)
  backInFlight = false
}

async function migrateLegacyHome(id: string) {
  const old = new Y.Doc()
  const persistence = new IndexeddbPersistence(LEGACY_DOC_NAME, old)
  await persistence.whenSynced
  const fragment = old.getXmlFragment('prosemirror')
  const title = old.getText('title').toString()
  if (title) pagesMap?.set(id, title)
  if (fragment.length > 0) {
    const dest = new Y.Doc()
    const destPersist = new IndexeddbPersistence(`page-${id}`, dest)
    await destPersist.whenSynced
    if (dest.getXmlFragment('prosemirror').length === 0) {
      Y.applyUpdate(dest, Y.encodeStateAsUpdate(old))
    }
    destPersist.destroy()
    dest.destroy()
  }
  persistence.destroy()
  old.destroy()
}

export async function openCatalog() {
  if (catalogDoc && pagesMap && metaMap) {
    return { homeId }
  }

  catalogDoc = new Y.Doc()
  catalogPersist = new IndexeddbPersistence(CATALOG_NAME, catalogDoc)
  pagesMap = catalogDoc.getMap('pages')
  metaMap = catalogDoc.getMap('meta')

  pagesMap.observe(emitTitles)
  await catalogPersist.whenSynced

  const existingHome = metaMap.get('home')
  if (existingHome && pagesMap.has(existingHome)) {
    homeId = existingHome
  } else {
    homeId = newBlockId()
    pagesMap.set(homeId, 'Untitled')
    metaMap.set('home', homeId)
    await migrateLegacyHome(homeId)
  }

  return { homeId }
}

export function destroyWorkspace() {
  cache.forEach((doc) => doc.destroy())
  cache.clear()
  catalogPersist?.destroy()
  catalogDoc?.destroy()
  catalogPersist = null
  catalogDoc = null
  pagesMap = null
  metaMap = null
}
