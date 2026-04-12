import type { Flavor, MockedContext } from 'svelte-look'

export const default_page_data: Record<string, any> = {
  app_name: 'Sample App',
}

export const default_contexts: MockedContext[] = []

export const flavors: Record<string, Flavor> = {
  english: {
    page_data: {
      app_name: 'Sample App',
      locale: 'en',
    },
  },
  spanish: {
    page_data: {
      app_name: 'Aplicación de Ejemplo',
      locale: 'es',
    },
  },
}
