import { define_config } from 'svelte-look'

export default define_config({
  css_files: ['src/lib/theme.css'],
  mocks: 'src/lib/mocks/svelte-look-mocks.ts',
  page_viewports: [{ width: 400, height: 500 }],
  dark_mode: true,
})
