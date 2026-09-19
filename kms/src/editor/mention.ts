import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { filterPages, type PageMeta } from '../pages/workspace'
import { createPageMention } from './schema'

export type MentionState = {
  active: boolean
  query: string
  from: number
  to: number
  index: number
}

export const mentionKey = new PluginKey<MentionState>('page-mention')

const inactive: MentionState = {
  active: false,
  query: '',
  from: 0,
  to: 0,
  index: 0,
}

export function matchingPages(query: string, currentPageId: string): PageMeta[] {
  return filterPages(query, currentPageId)
}

function deriveMention(state: EditorState, prev: MentionState, currentPageId: string): MentionState {
  const { $from, empty } = state.selection
  if (!empty || !$from.parent.isTextblock) return inactive

  const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const match = text.match(/(?:^|[\s])\+([^\s]*)$/)
  if (!match) return inactive

  const query = match[1]
  const token = `+${query}`
  const from = $from.start() + text.lastIndexOf(token)
  const pages = matchingPages(query, currentPageId)
  const index = pages.length === 0 ? 0 : Math.min(prev.active ? prev.index : 0, pages.length - 1)

  return {
    active: true,
    query,
    from,
    to: $from.start() + text.length,
    index,
  }
}

export function insertPageMention(view: EditorView, from: number, to: number, page: PageMeta) {
  const mention = createPageMention(page.id, page.title)
  const tr = view.state.tr.replaceWith(from, to, mention)
  tr.setSelection(TextSelection.near(tr.doc.resolve(from + mention.nodeSize)))
  view.dispatch(tr.scrollIntoView())
}

export function mentionPlugin(currentPageId: string) {
  return new Plugin<MentionState>({
    key: mentionKey,
    state: {
      init: () => ({ ...inactive }),
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(mentionKey) as Partial<MentionState> | undefined
        const derived = deriveMention(newState, value, currentPageId)
        if (meta) return { ...derived, ...meta, active: derived.active }
        return derived
      },
    },
    props: {
      handleKeyDown(view, event) {
        const mention = mentionKey.getState(view.state)
        if (!mention?.active) return false
        const pages = matchingPages(mention.query, currentPageId)
        if (event.key === 'ArrowDown') {
          if (pages.length === 0) return true
          view.dispatch(
            view.state.tr.setMeta(mentionKey, {
              index: (mention.index + 1) % pages.length,
            }),
          )
          return true
        }
        if (event.key === 'ArrowUp') {
          if (pages.length === 0) return true
          view.dispatch(
            view.state.tr.setMeta(mentionKey, {
              index: (mention.index - 1 + pages.length) % pages.length,
            }),
          )
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const page = pages[mention.index]
          if (!page) return false
          event.preventDefault()
          insertPageMention(view, mention.from, mention.to, page)
          return true
        }
        if (event.key === 'Escape') {
          view.dispatch(
            view.state.tr.setSelection(TextSelection.create(view.state.doc, mention.to)),
          )
          return true
        }
        return false
      },
    },
  })
}
