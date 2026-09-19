import type { Node as PMNode } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

function placeholderFor(name: string, attrs: Record<string, unknown>, isFirst: boolean): string | null {
  if (name === 'heading' && isFirst && Number(attrs.level) === 1) return 'Untitled'
  if (name === 'heading') return 'Heading'
  if (name === 'paragraph') return 'Type / for commands'
  if (name === 'toggle_title') return 'Toggle'
  return null
}

export function placeholderPlugin() {
  return new Plugin({
    props: {
      decorations(state) {
        const widgets: Decoration[] = []
        state.doc.forEach((node, offset, index) => {
          collect(node, offset, index === 0, widgets)
        })
        return DecorationSet.create(state.doc, widgets)
      },
    },
  })
}

function collect(node: PMNode, pos: number, isFirst: boolean, widgets: Decoration[]) {
  if (node.isTextblock && node.content.size === 0) {
    const text = placeholderFor(node.type.name, node.attrs, isFirst)
    if (text) {
      widgets.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'is-empty',
          'data-placeholder': text,
        }),
      )
    }
  }
  node.forEach((child, offset, index) => {
    collect(child, pos + 1 + offset, isFirst && index === 0, widgets)
  })
}
