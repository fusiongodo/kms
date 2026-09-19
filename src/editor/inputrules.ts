import { InputRule, inputRules } from 'prosemirror-inputrules'
import { TextSelection } from 'prosemirror-state'
import { createPage } from '../pages/workspace'
import { createPageLink, createParagraph, schema } from './schema'
import { newBlockId } from './ids'

function headingRule(level: 1 | 2 | 3) {
  return new InputRule(new RegExp(`^/h${level}$`), (state, _match, start, end) => {
    const { $from } = state.selection
    if (!$from.parent.type.isTextblock) return null
    if ($from.parent.type === schema.nodes.toggle_title) return null
    const pos = $from.before()
    return state.tr
      .delete(start, end)
      .setNodeMarkup(pos, schema.nodes.heading, {
        id: $from.parent.attrs.id || newBlockId(),
        level,
      })
  })
}

const toggleRule = new InputRule(/^\/tog(gle)?$/, (state, _match, start, end) => {
  const { $from } = state.selection
  if (!$from.parent.type.isTextblock) return null
  if ($from.parent.type === schema.nodes.toggle_title) return null
  const pos = $from.before()
  const node = $from.parent
  const remaining = node.content.cut(end - $from.start())
  const before = node.content.cut(0, start - $from.start())
  const titleContent = before.append(remaining)
  const toggle = schema.node(
    'toggle',
    { id: node.attrs.id || newBlockId(), collapsed: false },
    [schema.node('toggle_title', null, titleContent), schema.node('toggle_body', null, [])],
  )
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, toggle)
  tr.setSelection(TextSelection.create(tr.doc, pos + 1))
  return tr
})

const pageRule = new InputRule(/^\/page$/, (state, _match, start, end) => {
  const { $from } = state.selection
  if (!$from.parent.type.isTextblock) return null
  if ($from.parent.type === schema.nodes.toggle_title) return null
  const pos = $from.before()
  const node = $from.parent
  const leftover = node.content
    .cut(0, start - $from.start())
    .append(node.content.cut(end - $from.start()))
  const title = leftover.textBetween(0, leftover.size, ' ').trim() || 'Untitled'
  const page = createPage(title)
  const link = createPageLink(page.id, page.title, node.attrs.id || newBlockId())
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, [link, createParagraph()])
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos + link.nodeSize + 1)))
  return tr
})

const bulletRule = new InputRule(/^\s*[-*+]\s$/, (state, _match, start, end) => {
  const { $from } = state.selection
  if (!$from.parent.type.isTextblock) return null
  if ($from.parent.type === schema.nodes.toggle_title) return null
  if ($from.node(-1)?.type === schema.nodes.list_item) return null

  const pos = $from.before()
  const node = $from.parent
  const remaining = node.content.cut(end - $from.start())
  const item = schema.node('list_item', { id: node.attrs.id || newBlockId() }, [
    schema.node('paragraph', { id: newBlockId() }, remaining),
  ])
  const list = schema.node('bullet_list', null, [item])
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, list)
  tr.setSelection(TextSelection.create(tr.doc, pos + 2))
  return tr
})

export function editorInputRules() {
  return inputRules({
    rules: [
      bulletRule,
      headingRule(1),
      headingRule(2),
      headingRule(3),
      toggleRule,
      pageRule,
    ],
  })
}
