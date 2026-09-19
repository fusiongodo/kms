import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { prosemirrorToYXmlFragment } from 'y-prosemirror'
import { createEmptyDoc } from './schema'

export const DOC_NAME = 'local-page'
export const FRAGMENT_KEY = 'prosemirror'

export type LocalDoc = {
  ydoc: Y.Doc
  persistence: IndexeddbPersistence
  fragment: Y.XmlFragment
  title: Y.Text
  ready: Promise<void>
  destroy: () => void
}

export function openLocalDoc(): LocalDoc {
  const ydoc = new Y.Doc()
  const persistence = new IndexeddbPersistence(DOC_NAME, ydoc)
  const fragment = ydoc.getXmlFragment(FRAGMENT_KEY)
  const title = ydoc.getText('title')

  const ready = persistence.whenSynced.then(() => {
    if (fragment.length === 0) {
      prosemirrorToYXmlFragment(createEmptyDoc(), fragment)
    }
  })

  return {
    ydoc,
    persistence,
    fragment,
    title,
    ready,
    destroy() {
      persistence.destroy()
      ydoc.destroy()
    },
  }
}
