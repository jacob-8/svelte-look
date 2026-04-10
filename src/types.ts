import type { Component, ComponentProps } from 'svelte'

export interface StoryMeta {
  viewports?: Viewport[]
  page_data?: Record<string, any>
  contexts?: MockedContext[]
  /** Use client-side rendering via Puppeteer instead of SSR. Needed for components that rely on onMount, $state, or browser APIs. */
  csr?: boolean
  /** Puppeteer Page interactions to run before screenshot (requires csr: true). Receives a Puppeteer Page object. */
  interactions?: (page: any) => Promise<void>
}

export interface Story<TComponent extends Component<any>> extends StoryMeta {
  props?: ComponentProps<TComponent>
}

export interface PageStory<TComponent extends Component<any>> extends StoryMeta {
  props?: ComponentProps<TComponent>['data']
}

export interface Viewport {
  width: number
  height: number
}

export interface MockedContext {
  key: any
  value: any
}

export interface StoriesModule {
  shared_meta?: StoryMeta
  [story_name: string]: Story<any> | PageStory<any> | StoryMeta | undefined
}

export interface MocksModule {
  default_page_data?: Record<string, any>
  default_contexts?: MockedContext[]
}

export interface ResolvedStory {
  props: Record<string, any>
  page_data: Record<string, any>
  contexts: MockedContext[]
  viewports: Viewport[]
  csr: boolean
  interactions?: (page: any) => Promise<void>
}

export interface SvelteLookConfig {
  mocks?: string
  css_files?: string[]
  uno_config?: string
  page_viewports?: Viewport[]
}
