import { InputRule, inputRules } from 'prosemirror-inputrules'
import { wrappingInputRule } from 'prosemirror-inputrules'
import { TextSelection } from 'prosemirror-state'
import { schema } from './schema'
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

export function editorInputRules() {
  return inputRules({
    rules: [
      wrappingInputRule(/^\s*-\s$/, schema.nodes.bullet_list),
      headingRule(1),
      headingRule(2),
      headingRule(3),
      toggleRule,
    ],
  })
}
