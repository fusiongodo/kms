import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { initProseMirrorDoc, ySyncPlugin, yUndoPlugin } from 'y-prosemirror'
import type { XmlFragment } from 'yjs'
import { schema } from './schema'
import { ensureBlockIds } from './ids'
import { editorKeymap, yUndoKeymap } from './keymap'
import { editorInputRules } from './inputrules'
import { slashPlugin } from './slash'
import { ToggleView } from './nodeviews'

const protectedNodes = new Set(['paragraph', 'heading', 'list_item', 'toggle'])

export function createEditorView(mount: HTMLElement, fragment: XmlFragment) {
  const { doc, mapping } = initProseMirrorDoc(fragment, schema)
  const state = EditorState.create({
    doc,
    schema,
    plugins: [
      editorKeymap(),
      editorInputRules(),
      ensureBlockIds(),
      slashPlugin(),
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
