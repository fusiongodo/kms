export type EditorHooks = {
  onOpenPage: (pageId: string) => void
  goBack: () => boolean
  pageId: string
}