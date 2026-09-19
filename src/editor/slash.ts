import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { convertToHeading, convertToToggle, wrapInBulletList } from './commands'

export type SlashItem = {
  id: string
  label: string
  hint: string
  aliases: string[]
  run: (view: EditorView, from: number, to: number) => void
}

export type SlashState = {
  active: boolean
  query: string
  from: number
  to: number
  index: number
}

export const slashKey = new PluginKey<SlashState>('slash-menu')

const inactive: SlashState = {
  active: false,
  query: '',
  from: 0,
  to: 0,
  index: 0,
}

function applyType(view: EditorView, from: number, to: number, command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean) {
  view.dispatch(view.state.tr.delete(from, to))
  command(view.state, (tr) => view.dispatch(tr))
}

export const slashItems: SlashItem[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    hint: '/h1',
    aliases: ['h1', 'heading1', 'title'],
    run: (view, from, to) => applyType(view, from, to, convertToHeading(1)),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    hint: '/h2',
    aliases: ['h2', 'heading2'],
    run: (view, from, to) => applyType(view, from, to, convertToHeading(2)),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    hint: '/h3',
    aliases: ['h3', 'heading3'],
    run: (view, from, to) => applyType(view, from, to, convertToHeading(3)),
  },
  {
    id: 'toggle',
    label: 'Toggle',
    hint: '/tog',
    aliases: ['tog', 'toggle', 'fold'],
    run: (view, from, to) => applyType(view, from, to, convertToToggle()),
  },
  {
    id: 'bullet',
    label: 'Bullet list',
    hint: '- ',
    aliases: ['bullet', 'list', 'ul'],
    run: (view, from, to) => applyType(view, from, to, wrapInBulletList()),
  },
]

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.toLowerCase()
  if (!q) return slashItems
  return slashItems.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.aliases.some((alias) => alias.startsWith(q) || alias.includes(q)),
  )
}

function deriveSlash(state: EditorState, prev: SlashState): SlashState {
  const { $from, empty } = state.selection
  if (!empty || !$from.parent.isTextblock) return inactive
  if ($from.parent.type.name === 'toggle_title') return inactive

  const start = $from.start()
  const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const match = text.match(/^\/([^\s]*)$/)
  if (!match) return inactive

  const query = match[1]
  const items = filterSlashItems(query)
  const index = items.length === 0 ? 0 : Math.min(prev.active ? prev.index : 0, items.length - 1)

  return {
    active: true,
    query,
    from: start,
    to: start + text.length,
    index,
  }
}

export function slashPlugin() {
  return new Plugin<SlashState>({
    key: slashKey,
    state: {
      init: () => ({ ...inactive }),
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(slashKey) as Partial<SlashState> | undefined
        const derived = deriveSlash(newState, value)
        if (meta) return { ...derived, ...meta, active: derived.active }
        return derived
      },
    },
    props: {
      handleKeyDown(view, event) {
        const slash = slashKey.getState(view.state)
        if (!slash?.active) return false
        const items = filterSlashItems(slash.query)
        if (event.key === 'ArrowDown') {
          if (items.length === 0) return true
          view.dispatch(
            view.state.tr.setMeta(slashKey, {
              index: (slash.index + 1) % items.length,
            }),
          )
          return true
        }
        if (event.key === 'ArrowUp') {
          if (items.length === 0) return true
          view.dispatch(
            view.state.tr.setMeta(slashKey, {
              index: (slash.index - 1 + items.length) % items.length,
            }),
          )
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[slash.index]
          if (!item) return false
          event.preventDefault()
          item.run(view, slash.from, slash.to)
          return true
        }
        if (event.key === 'Escape') {
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.create(view.state.doc, slash.to),
            ),
          )
          return true
        }
        return false
      },
    },
  })
}
