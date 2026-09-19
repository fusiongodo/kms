import { v4 as uuidv4 } from 'uuid'
import { Plugin } from 'prosemirror-state'
import type { Node as PMNode } from 'prosemirror-model'

export const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'list_item',
  'toggle',
  'page_link',
])

export function newBlockId(): string {
  return uuidv4()
}

export function withNewId(attrs: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...attrs, id: newBlockId() }
}

function collectMissingIds(node: PMNode, pos: number, missing: { pos: number; node: PMNode }[]) {
  if (BLOCK_TYPES.has(node.type.name) && !node.attrs.id) {
    missing.push({ pos, node })
  }
  node.forEach((child, offset) => {
    collectMissingIds(child, pos + 1 + offset, missing)
  })
}

export function ensureBlockIds(): Plugin {
  return new Plugin({
    appendTransaction(_transactions, _oldState, newState) {
      const missing: { pos: number; node: PMNode }[] = []
      collectMissingIds(newState.doc, 0, missing)
      if (missing.length === 0) return null

      let tr = newState.tr
      for (let i = missing.length - 1; i >= 0; i--) {
        const { pos, node } = missing[i]
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id: newBlockId(),
        })
      }
      return tr
    },
  })
}
