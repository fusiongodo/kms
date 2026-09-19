import { TextSelection, type Command } from 'prosemirror-state'
import type { ResolvedPos } from 'prosemirror-model'
import { liftListItem, sinkListItem } from 'prosemirror-schema-list'
import { schema } from './schema'
import { wrapInBulletList } from './commands'

function movingBlock($from: ResolvedPos) {
  if ($from.parent.type === schema.nodes.toggle_title) return null

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.spec.group === 'block') {
      return { node, pos: $from.before(depth), depth }
    }
  }
  return null
}

function nestIntoPreviousToggle(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const current = movingBlock($from)
    if (!current) return false

    const $block = state.doc.resolve(current.pos)
    const prev = $block.nodeBefore
    if (!prev || prev.type !== schema.nodes.toggle) return false

    const prevPos = current.pos - prev.nodeSize
    const title = prev.child(0)
    const body = prev.child(1)
    const insertAt = prevPos + 1 + title.nodeSize + 1 + body.content.size

    if (dispatch) {
      const block = current.node
      const tr = state.tr.delete(current.pos, current.pos + block.nodeSize)
      tr.insert(insertAt, block)
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

function liftOutOfToggle(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    let bodyDepth = -1
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === schema.nodes.toggle_body) {
        bodyDepth = d
        break
      }
    }
    if (bodyDepth < 0) return false

    const index = $from.index(bodyDepth)
    const body = $from.node(bodyDepth)
    const block = body.child(index)
    let offset = $from.start(bodyDepth)
    for (let i = 0; i < index; i++) offset += body.child(i).nodeSize
    const blockPos = offset

    const toggleDepth = bodyDepth - 1
    const toggle = $from.node(toggleDepth)
    const togglePos = $from.before(toggleDepth)
    const afterToggle = togglePos + toggle.nodeSize

    if (dispatch) {
      const tr = state.tr.delete(blockPos, blockPos + block.nodeSize)
      const mappedAfter = tr.mapping.map(afterToggle)
      tr.insert(mappedAfter, block)
      tr.setSelection(TextSelection.near(tr.doc.resolve(mappedAfter + 1)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function indentBlock(): Command {
  return (state, dispatch) => {
    if (state.selection.$from.node(-1)?.type === schema.nodes.list_item) {
      if (sinkListItem(schema.nodes.list_item)(state, dispatch)) return true
    }
    if (nestIntoPreviousToggle()(state, dispatch)) return true
    return wrapInBulletList()(state, dispatch)
  }
}

export function outdentBlock(): Command {
  return (state, dispatch) => {
    if (state.selection.$from.node(-1)?.type === schema.nodes.list_item) {
      if (liftListItem(schema.nodes.list_item)(state, dispatch)) return true
    }
    return liftOutOfToggle()(state, dispatch)
  }
}
