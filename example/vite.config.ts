import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { svelte_look } from 'svelte-look/vite'

export default defineConfig({
  plugins: [
    svelte_look(),
    sveltekit(),
  ],
})
