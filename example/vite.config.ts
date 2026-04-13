import { sveltekit } from '@sveltejs/kit/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import { svelte_look } from 'svelte-look/vite'

export default defineConfig({
  plugins: [
    UnoCSS(),
    svelte_look(),
    sveltekit(),
  ],
})
