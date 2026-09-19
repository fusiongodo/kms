import { keymap } from 'prosemirror-keymap'
import {
  chainCommands,
  deleteSelection,
  joinBackward,
  joinForward,
  selectNodeBackward,
  selectNodeForward,
  toggleMark,
} from 'prosemirror-commands'
import { undo, redo } from 'y-prosemirror'
import { schema } from './schema'
import {
  insertHardBreak,
  joinBackwardRespectingIds,
  skipCollapsedToggleBody,
  splitBlockWithNewId,
} from './commands'
import { indentBlock, outdentBlock } from './indent'

export function editorKeymap() {
  return keymap({
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    Enter: splitBlockWithNewId(),
    ArrowDown: skipCollapsedToggleBody(1),
    'Shift-Enter': insertHardBreak(),
    Tab: (state, dispatch, view) => {
      indentBlock()(state, dispatch, view)
      return true
    },
    'Shift-Tab': (state, dispatch, view) => {
      outdentBlock()(state, dispatch, view)
      return true
    },
    Backspace: chainCommands(
      deleteSelection,
      joinBackwardRespectingIds(),
      joinBackward,
      selectNodeBackward,
    ),
    Delete: chainCommands(deleteSelection, joinForward, selectNodeForward),
  })
}

export function yUndoKeymap() {
  return keymap({
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,
  })
}
