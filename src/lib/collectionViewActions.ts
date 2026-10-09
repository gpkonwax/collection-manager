export function allowsCollectionSelection(viewMode: 'classic' | 'binder' | 'saved'): boolean {
  return viewMode !== 'binder';
}