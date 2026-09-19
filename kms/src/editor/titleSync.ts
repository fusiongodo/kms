import { Plugin } from 'prosemirror-state'
import { setPageTitle } from '../pages/workspace'

export function titleSyncPlugin(pageId: string) {
  return new Plugin({
    view(view) {
      const report = () => {
        const first = view.state.doc.firstChild
        const title =
          first?.type.name === 'heading' ? first.textContent.trim() : ''
        setPageTitle(pageId, title)
      }
      report()
      return {
        update(view, prevState) {
          if (view.state.doc !== prevState.doc) report()
        },
      }
    },
  })
}
