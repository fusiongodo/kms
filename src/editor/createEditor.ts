import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { initProseMirrorDoc, prosemirrorToYXmlFragment, ySyncPlugin, yUndoPlugin } from 'y-prosemirror'
import type { XmlFragment } from 'yjs'
import { createEmptyDoc, schema } from './schema'
import { ensureBlockIds } from './ids'
import { editorKeymap, yUndoKeymap } from './keymap'
import { editorInputRules } from './inputrules'
import { slashPlugin } from './slash'
import { mentionPlugin } from './mention'
import { placeholderPlugin } from './placeholders'
import { PageLinkView, PageMentionView, ToggleView } from './nodeviews'
import { titleSyncPlugin } from './titleSync'
import type { EditorHooks } from './hooks'

const protectedNodes = new Set(['paragraph', 'heading', 'list_item', 'toggle', 'page_link'])

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

export function createEditorView(mount: HTMLElement, fragment: XmlFragment, hooks: EditorHooks) {
  const { doc, mapping } = loadDoc(fragment)
  const state = EditorState.create({
    doc,
    schema,
    plugins: [
      mentionPlugin(hooks.pageId),
      slashPlugin(),
      editorKeymap(hooks),
      editorInputRules(),
      ensureBlockIds(),
      placeholderPlugin(),
      titleSyncPlugin(hooks.pageId),
      ySyncPlugin(fragment, { mapping }),
      yUndoPlugin({ protectedNodes }),
      yUndoKeymap(),
    ],
  })

  return new EditorView(mount, {
    state,
    nodeViews: {
      toggle: (node, view, getPos) => new ToggleView(node, view, getPos),
      page_link: (node, view, getPos) => new PageLinkView(node, view, getPos, hooks.onOpenPage),
      page_mention: (node, view, getPos) => new PageMentionView(node, view, getPos, hooks.onOpenPage),
    },
    attributes: {
      class: 'ProseMirror page-doc',
      role: 'textbox',
      'aria-label': 'Page',
    },
  })
}
