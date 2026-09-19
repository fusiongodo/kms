import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { initProseMirrorDoc, prosemirrorToYXmlFragment, ySyncPlugin, yUndoPlugin } from 'y-prosemirror'
import type { XmlFragment } from 'yjs'
import { createEmptyDoc, schema } from './schema'
import { ensureBlockIds } from './ids'
import { editorKeymap, yUndoKeymap } from './keymap'
import { editorInputRules } from './inputrules'
import { slashPlugin } from './slash'
import { placeholderPlugin } from './placeholders'
import { ToggleView } from './nodeviews'

const protectedNodes = new Set(['paragraph', 'heading', 'list_item', 'toggle'])

function loadDoc(fragment: XmlFragment) {
  try {
    const loaded = initProseMirrorDoc(fragment, schema)
    if (loaded.doc.childCount > 0) return loaded
  } catch {
    // fall through and seed
  }
  if (fragment.length > 0) fragment.delete(0, fragment.length)
  prosemirrorToYXmlFragment(createEmptyDoc(), fragment)
  return initProseMirrorDoc(fragment, schema)
}

export function createEditorView(mount: HTMLElement, fragment: XmlFragment) {
  const { doc, mapping } = loadDoc(fragment)
  const state = EditorState.create({
    doc,
    schema,
    plugins: [
      slashPlugin(),
      editorKeymap(),
      editorInputRules(),
      ensureBlockIds(),
      placeholderPlugin(),
      ySyncPlugin(fragment, { mapping }),
      yUndoPlugin({ protectedNodes }),
      yUndoKeymap(),
    ],
  })

  return new EditorView(mount, {
    state,
    nodeViews: {
      toggle: (node, view, getPos) => new ToggleView(node, view, getPos),
    },
    attributes: {
      class: 'ProseMirror page-doc',
      role: 'textbox',
      'aria-label': 'Page',
    },
  })
}
