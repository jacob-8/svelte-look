import type { Flavor, MockedContext, MocksModule, ResolvedStory, Story, StoryMeta, Viewport } from '../types.js'

export function resolve_story({ story, shared_meta, mocks, is_page, default_page_viewports, flavor }: {
  story: Story<any>
  shared_meta?: StoryMeta
  mocks: MocksModule
  is_page: boolean
  default_page_viewports: Viewport[]
  flavor?: Flavor
}): ResolvedStory {
  const props = story.props ?? {}

  const page_data = {
    ...(mocks.default_page_data ?? {}),
    ...(flavor?.page_data ?? {}),
    ...(shared_meta?.page_data ?? {}),
    ...(story.page_data ?? {}),
  }

  const contexts = merge_contexts([
    ...(mocks.default_contexts ?? []),
    ...(shared_meta?.contexts ?? []),
    ...(story.contexts ?? []),
  ])

  const viewports = resolve_viewports({ story, shared_meta, is_page, default_page_viewports })
  const csr = story.csr ?? shared_meta?.csr ?? false
  const interactions = story.interactions ?? shared_meta?.interactions

  return { props, page_data, contexts, viewports, csr, interactions }
}

function resolve_viewports({ story, shared_meta, is_page, default_page_viewports }: {
  story: Story<any>
  shared_meta?: StoryMeta
  is_page: boolean
  default_page_viewports: Viewport[]
}): Viewport[] {
  if (story.viewports?.length)
    return story.viewports

  if (shared_meta?.viewports?.length)
    return shared_meta.viewports

  if (is_page)
    return default_page_viewports

  throw new Error('Component stories must define viewports in shared_meta or per-story. Add viewports to your .stories.ts file.')
}

function merge_contexts(all_contexts: MockedContext[]): MockedContext[] {
  const context_map = new Map<any, any>()
  for (const { key, value } of all_contexts)
    context_map.set(key, value)
  return Array.from(context_map.entries(), ([key, value]) => ({ key, value }))
}
