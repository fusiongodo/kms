import { NodeSelection, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state'
import { Fragment, type Node as PMNode, type NodeType, type ResolvedPos } from 'prosemirror-model'
import { canSplit } from 'prosemirror-transform'
import { schema, createParagraph, createToggle, createPageLink, isCollapsed } from './schema'
import { createPage } from '../pages/workspace'
import { newBlockId } from './ids'

export function setBlockTypeKeepingId(
  nodeType: NodeType,
  attrs: Record<string, unknown> = {},
): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    let depth = $from.depth
    while (depth > 0 && !$from.node(depth).type.isBlock) depth--
    const node = $from.node(depth)
    if (!node || node.type === schema.nodes.toggle_title) return false
    if (!node.type.isTextblock && node.type !== schema.nodes.toggle) return false

    if (node.type === nodeType) {
      if (nodeType === schema.nodes.heading && node.attrs.level === attrs.level) {
        return false
      }
      if (nodeType !== schema.nodes.heading) return false
    }

    if (dispatch) {
      const pos = $from.before(depth)
      const nextAttrs = {
        ...attrs,
        id: node.attrs.id || newBlockId(),
      }
      dispatch(state.tr.setNodeMarkup(pos, nodeType, nextAttrs))
    }
    return true
  }
}

export function convertToHeading(level: 1 | 2 | 3): Command {
  return setBlockTypeKeepingId(schema.nodes.heading, { level })
}

export function convertToParagraph(): Command {
  return setBlockTypeKeepingId(schema.nodes.paragraph)
}

export function convertToToggle(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const node = $from.parent
    if (!node.type.isTextblock) return false
    if (node.type === schema.nodes.toggle_title) return false

    const depth = $from.depth
    const pos = $from.before(depth)
    const content = node.content
    const toggle = schema.node(
      'toggle',
      { id: node.attrs.id || newBlockId(), collapsed: false },
      [schema.node('toggle_title', null, content), schema.node('toggle_body', null, [])],
    )

    if (dispatch) {
      const tr = state.tr.replaceWith(pos, pos + node.nodeSize, toggle)
      const titlePos = pos + 1
      tr.setSelection(TextSelection.create(tr.doc, titlePos))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function convertToPageLink(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const node = $from.parent
    if (!node.type.isTextblock) return false
    if (node.type === schema.nodes.toggle_title) return false

    const title = node.textContent.trim() || 'Untitled'
    const page = createPage(title)
    const pos = $from.before()
    const link = createPageLink(page.id, page.title, node.attrs.id || newBlockId())

    if (dispatch) {
      const tr = state.tr.replaceWith(pos, pos + node.nodeSize, [link, createParagraph()])
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + link.nodeSize + 1)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function openSelectedPage(open: (pageId: string) => void): Command {
  return (state) => {
    if (!(state.selection instanceof NodeSelection)) return false
    const node = state.selection.node
    if (
      (node.type !== schema.nodes.page_link && node.type !== schema.nodes.page_mention) ||
      !node.attrs.pageId
    ) {
      return false
    }
    open(node.attrs.pageId)
    return true
  }
}

export function wrapInBulletList(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if (!$from.parent.type.isTextblock) return false
    if ($from.parent.type === schema.nodes.toggle_title) return false
    if ($from.node(-1)?.type === schema.nodes.list_item) return false

    const pos = $from.before()
    const node = $from.parent
    const item = schema.node('list_item', { id: node.attrs.id || newBlockId() }, [
      schema.node('paragraph', { id: newBlockId() }, node.content),
    ])
    const list = schema.node('bullet_list', null, [item])
    if (dispatch) {
      const tr = state.tr.replaceWith(pos, pos + node.nodeSize, list)
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 2)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

function insertParagraphAfter(
  $from: ResolvedPos,
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
) {
  if (!dispatch) return true
  const after = $from.after()
  const para = createParagraph()
  const tr = state.tr.insert(after, para)
  tr.setSelection(TextSelection.create(tr.doc, after + 1))
  dispatch(tr.scrollIntoView())
  return true
}

export function splitBlockWithNewId(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection
    if (!empty) return false

    if ($from.parent.type === schema.nodes.toggle_title) {
      return splitToggleTitle()(state, dispatch)
    }

    if (listItemDepth($from) >= 0) {
      return splitListItemAtCursor()(state, dispatch)
    }

    if (!$from.parent.type.isTextblock) return false

    const atEnd = $from.parentOffset === $from.parent.content.size
    if (atEnd) {
      return insertParagraphAfter($from, state, dispatch)
    }

    const type = $from.parent.type
    const attrs =
      type === schema.nodes.heading
        ? { id: newBlockId(), level: $from.parent.attrs.level }
        : { id: newBlockId() }

    if (!canSplit(state.doc, $from.pos, 1, [{ type, attrs }])) {
      return insertParagraphAfter($from, state, dispatch)
    }

    if (dispatch) {
      dispatch(state.tr.split($from.pos, 1, [{ type, attrs }]).scrollIntoView())
    }
    return true
  }
}

function listItemDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes.list_item) return d
  }
  return -1
}

function exitEmptyListItem(itemDepth: number): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const item = $from.node(itemDepth)
    const itemPos = $from.before(itemDepth)
    const listDepth = itemDepth - 1
    const list = $from.node(listDepth)
    const listPos = $from.before(listDepth)
    const para = createParagraph()

    if (!dispatch) return true

    if (list.childCount === 1) {
      const tr = state.tr.replaceWith(listPos, listPos + list.nodeSize, para)
      tr.setSelection(TextSelection.create(tr.doc, listPos + 1))
      dispatch(tr.scrollIntoView())
      return true
    }

    const index = $from.index(listDepth)
    const tr = state.tr.delete(itemPos, itemPos + item.nodeSize)
    if (index === list.childCount - 1) {
      const afterList = tr.mapping.map(listPos + list.nodeSize)
      tr.insert(afterList, para)
      tr.setSelection(TextSelection.create(tr.doc, afterList + 1))
    } else {
      const insertAt = tr.mapping.map(itemPos)
      tr.insert(insertAt, para)
      tr.setSelection(TextSelection.create(tr.doc, insertAt + 1))
    }
    dispatch(tr.scrollIntoView())
    return true
  }
}

function splitListItemAtCursor(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection
    if (!empty) return false
    const itemDepth = listItemDepth($from)
    if (itemDepth < 0) return false

    const item = $from.node(itemDepth)
    if ($from.parent.content.size === 0 && item.childCount === 1) {
      return exitEmptyListItem(itemDepth)(state, dispatch)
    }

    if (!dispatch) return true

    const itemPos = $from.before(itemDepth)
    const index = $from.index(itemDepth)
    const offset = $from.parentOffset
    const leftNodes: PMNode[] = []
    const rightNodes: PMNode[] = []

    for (let i = 0; i < item.childCount; i++) {
      const child = item.child(i)
      if (i < index) {
        leftNodes.push(child)
      } else if (i > index) {
        rightNodes.push(child)
      } else if (child.type.isTextblock) {
        leftNodes.push(child.type.create(child.attrs, child.content.cut(0, offset), child.marks))
        rightNodes.push(
          schema.nodes.paragraph.create({ id: newBlockId() }, child.content.cut(offset)),
        )
      } else {
        leftNodes.push(child)
      }
    }

    if (leftNodes.length === 0) leftNodes.push(createParagraph())
    if (rightNodes.length === 0) rightNodes.push(createParagraph())

    const left = item.type.create(item.attrs, leftNodes)
    const right = item.type.create({ id: newBlockId() }, rightNodes)
    const tr = state.tr.replaceWith(itemPos, itemPos + item.nodeSize, [left, right])
    tr.setSelection(TextSelection.near(tr.doc.resolve(itemPos + left.nodeSize + 1)))
    dispatch(tr.scrollIntoView())
    return true
  }
}

function insertParagraphAfterToggle(
  togglePos: number,
  toggle: PMNode,
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
) {
  if (!dispatch) return true
  const after = togglePos + toggle.nodeSize
  const para = createParagraph()
  const tr = state.tr.insert(after, para)
  tr.setSelection(TextSelection.create(tr.doc, after + 1))
  dispatch(tr.scrollIntoView())
  return true
}

export function skipCollapsedToggleBody(dir: 1 | -1): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parent.type !== schema.nodes.toggle_title) return false
    const toggleDepth = $from.depth - 1
    const toggle = $from.node(toggleDepth)
    if (toggle.type !== schema.nodes.toggle) return false
    if (!isCollapsed(toggle.attrs.collapsed)) return false

    const togglePos = $from.before(toggleDepth)
    if (dir < 0) return false
    const after = togglePos + toggle.nodeSize
    if (after >= state.doc.content.size) {
      return insertParagraphAfterToggle(togglePos, toggle, state, dispatch)
    }
    if (dispatch) {
      dispatch(
        state.tr
          .setSelection(TextSelection.near(state.doc.resolve(after), 1))
          .scrollIntoView(),
      )
    }
    return true
  }
}

function splitToggleTitle(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parent.type !== schema.nodes.toggle_title) return false

    const toggleDepth = $from.depth - 1
    const toggle = $from.node(toggleDepth)
    if (toggle.type !== schema.nodes.toggle) return false

    const togglePos = $from.before(toggleDepth)
    if (isCollapsed(toggle.attrs.collapsed)) {
      return insertParagraphAfterToggle(togglePos, toggle, state, dispatch)
    }

    const title = toggle.child(0)
    const body = toggle.child(1)
    const offset = $from.parentOffset
    const before = title.content.cut(0, offset)
    const after = title.content.cut(offset)

    if (dispatch) {
      const newTitle = schema.node('toggle_title', null, before)
      let newBody: PMNode
      if (after.size > 0) {
        const moved = schema.node('paragraph', { id: newBlockId() }, after)
        newBody = schema.node(
          'toggle_body',
          null,
          Fragment.from(moved).append(body.content),
        )
      } else if (body.childCount === 0) {
        newBody = schema.node('toggle_body', null, [createParagraph()])
      } else {
        newBody = body
      }

      const next = schema.node('toggle', toggle.attrs, [newTitle, newBody])
      const tr = state.tr.replaceWith(togglePos, togglePos + toggle.nodeSize, next)
      const insertPos = togglePos + 1 + newTitle.nodeSize + 1
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function insertHardBreak(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if (!$from.parent.type.isTextblock) return false
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(schema.nodes.hard_break.create())
          .scrollIntoView(),
      )
    }
    return true
  }
}

export function toggleCollapsed(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos)
    if (!node || node.type !== schema.nodes.toggle) return false
    if (dispatch) {
      dispatch(
        state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          collapsed: !node.attrs.collapsed,
        }),
      )
    }
    return true
  }
}

export function joinBackwardRespectingIds(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection
    if (!empty || $from.parentOffset !== 0) return false

    if ($from.parent.type === schema.nodes.toggle_title) {
      return unwrapToggleAtStart()(state, dispatch)
    }

    const $cut = $from
    if ($cut.depth === 0) return false

    const indexBefore = $cut.index($cut.depth - 1)
    if (indexBefore === 0) {
      const parent = $cut.node($cut.depth - 1)
      if (parent.type === schema.nodes.list_item && $cut.depth >= 2) {
        return false
      }
      if (parent.type === schema.nodes.toggle_body) {
        return joinIntoToggleTitle()(state, dispatch)
      }
    }

    const beforePos = $cut.before($cut.depth)
    const $before = state.doc.resolve(beforePos)
    if (!$before.nodeBefore) return false

    const nodeBefore = $before.nodeBefore
    const node = $cut.parent

    if (nodeBefore.type.isTextblock && node.type.isTextblock) {
      if (dispatch) {
        const tr = state.tr
        const joinPos = beforePos - 1
        tr.delete(beforePos, beforePos + node.nodeSize)
        tr.insert(joinPos, node.content)
        tr.setSelection(TextSelection.create(tr.doc, joinPos))
        dispatch(tr.scrollIntoView())
      }
      return true
    }

    return false
  }
}

function unwrapToggleAtStart(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parent.type !== schema.nodes.toggle_title || $from.parentOffset !== 0) {
      return false
    }
    const toggleDepth = $from.depth - 1
    const toggle = $from.node(toggleDepth)
    const togglePos = $from.before(toggleDepth)
    const title = toggle.child(0)
    const body = toggle.child(1)
    const paragraph = schema.node(
      'paragraph',
      { id: toggle.attrs.id || newBlockId() },
      title.content,
    )
    const nodes: PMNode[] = [paragraph]
    body.forEach((child) => nodes.push(child))

    if (dispatch) {
      const tr = state.tr.replaceWith(togglePos, togglePos + toggle.nodeSize, nodes)
      tr.setSelection(TextSelection.create(tr.doc, togglePos + 1))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

function joinIntoToggleTitle(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parentOffset !== 0) return false
    const bodyDepth = $from.depth - 1
    if ($from.node(bodyDepth).type !== schema.nodes.toggle_body) return false
    if ($from.index(bodyDepth) !== 0) return false

    const toggleDepth = bodyDepth - 1
    const toggle = $from.node(toggleDepth)
    const togglePos = $from.before(toggleDepth)
    const title = toggle.child(0)
    const body = toggle.child(1)
    const first = body.child(0)
    if (!first.type.isTextblock) return false

    const newTitle = schema.node(
      'toggle_title',
      null,
      title.content.append(first.content),
    )
    const rest: PMNode[] = []
    for (let i = 1; i < body.childCount; i++) rest.push(body.child(i))
    const newBody = schema.node('toggle_body', null, rest)
    const next = schema.node('toggle', toggle.attrs, [newTitle, newBody])
    const sel = togglePos + 1 + title.content.size

    if (dispatch) {
      const tr = state.tr.replaceWith(togglePos, togglePos + toggle.nodeSize, next)
      tr.setSelection(TextSelection.create(tr.doc, sel))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function createToggleAtCursor(): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const toggle = createToggle()
      const tr = state.tr.replaceSelectionWith(toggle)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}
