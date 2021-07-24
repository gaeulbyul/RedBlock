export function* getAddedElementsFromMutations(
  mutations: MutationRecord[]
): IterableIterator<HTMLElement> {
  for (const mut of mutations) {
    for (const node of mut.addedNodes) {
      if (node instanceof HTMLElement) {
        yield node
      }
    }
  }
}
