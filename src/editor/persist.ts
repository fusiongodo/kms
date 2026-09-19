import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { prosemirrorToYXmlFragment } from 'y-prosemirror'
import { createEmptyDoc } from './schema'

export const FRAGMENT_KEY = 'prosemirror'

export type LocalDoc = {
  ydoc: Y.Doc
  persistence: IndexeddbPersistence
  fragment: Y.XmlFragment
  title: Y.Text
  ready: Promise<void>
  destroy: () => void
}

function isEmptyXmlNode(node: unknown): boolean {
  if (node instanceof Y.XmlText) return node.length === 0
  if (!(node instanceof Y.XmlElement)) return false
  if (node.length === 0) return true
  return node.toArray().every((child) => isEmptyXmlNode(child))
}

function seedIfNeeded(fragment: Y.XmlFragment, title: Y.Text) {
  const heading = title.toString()
  if (fragment.length === 0) {
    prosemirrorToYXmlFragment(createEmptyDoc(heading), fragment)
    return
  }

  const first = fragment.get(0)
  const onlyEmptyParagraph =
    fragment.length === 1 &&
    first instanceof Y.XmlElement &&
    first.nodeName === 'paragraph' &&
    isEmptyXmlNode(first)

  if (onlyEmptyParagraph) {
    fragment.delete(0, 1)
    prosemirrorToYXmlFragment(createEmptyDoc(heading), fragment)
  }
}

export function openNamedDoc(name: string, seedTitle = ''): LocalDoc {
  const ydoc = new Y.Doc()
  const persistence = new IndexeddbPersistence(name, ydoc)
  const fragment = ydoc.getXmlFragment(FRAGMENT_KEY)
  const title = ydoc.getText('title')

  const ready = persistence.whenSynced.then(() => {
    if (seedTitle && title.length === 0) title.insert(0, seedTitle)
    seedIfNeeded(fragment, title)
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
