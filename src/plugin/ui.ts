import type { ComponentInfo } from './api.js'
import type { SvelteLookConfig } from '../types.js'

export function render_index_page({ components, config }: {
  components: ComponentInfo[]
  config: SvelteLookConfig
}): string {
  const grouped = group_by_directory(components)
  const dark_mode = config.dark_mode === true

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>svelte-look</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; height: 100vh; overflow: hidden; }

  .layout { display: flex; height: 100vh; }

  .sidebar {
    width: 280px;
    min-width: 280px;
    background: #1a1a2e;
    color: #e0e0e0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #2a2a4a;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sidebar-header h1 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .logo { font-size: 20px; }

  .filter-input {
    margin: 12px;
    padding: 8px 12px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    outline: none;
  }

  .filter-input:focus { border-color: #6366f1; }
  .filter-input::placeholder { color: #666; }

  .tree { flex: 1; overflow-y: auto; padding: 4px 0; }

  .directory {
    padding: 6px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    margin-top: 8px;
  }

  .component {
    cursor: pointer;
    user-select: none;
  }

  .component-name {
    padding: 5px 16px 5px 24px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #ccc;
  }

  .component-name:hover { background: #2a2a4a; }

  .component-name .arrow {
    font-size: 10px;
    transition: transform 0.15s;
    color: #666;
  }

  .component.open > .component-name .arrow { transform: rotate(90deg); }

  .stories { display: none; }
  .component.open > .stories { display: block; }

  .story-link {
    display: block;
    padding: 4px 16px 4px 44px;
    font-size: 12px;
    color: #999;
    cursor: pointer;
    text-decoration: none;
  }

  .story-link:hover { background: #2a2a4a; color: #e0e0e0; }
  .story-link.active { background: #6366f1; color: #fff; }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
  }

  .toolbar {
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: #666;
    min-height: 44px;
  }

  .toolbar .path { color: #333; font-weight: 500; }

  .toolbar-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar select, .toolbar button {
    padding: 4px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    font-size: 12px;
    color: #333;
    cursor: pointer;
  }

  .toolbar button:hover { background: #f0f0f0; }
  .toolbar button.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }

  .preview-frame {
    flex: 1;
    border: none;
    background: #fff;
  }

  .dark-mode .main { background: #1a1a1a; }
  .dark-mode .toolbar { background: #222; border-color: #333; color: #999; }
  .dark-mode .toolbar .path { color: #e0e0e0; }
  .dark-mode .toolbar select, .dark-mode .toolbar button { background: #333; color: #e0e0e0; border-color: #444; }
  .dark-mode .toolbar button:hover { background: #444; }
  .dark-mode .preview-frame { background: #1a1a1a; }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 14px;
  }

  .hidden { display: none !important; }
</style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="logo">\u{1F441}</span>
      <h1>svelte-look</h1>
    </div>
    <input class="filter-input" type="text" placeholder="Filter components..." id="filter">
    <div class="tree" id="tree">
      ${render_tree(grouped)}
    </div>
  </div>
  <div class="main">
    <div class="toolbar" id="toolbar">
      <span class="path" id="toolbar-path">Select a component story</span>
      <div class="toolbar-controls">
        ${dark_mode ? '<button id="dark-toggle" onclick="toggleDark()">Dark</button>' : ''}
        <select id="flavor-select" class="hidden" onchange="loadStory()">
        </select>
        <button onclick="openInNewTab()" title="Open in new tab">\u{2197}</button>
      </div>
    </div>
    <iframe class="preview-frame" id="preview"></iframe>
  </div>
</div>

<script>
  const components = ${JSON.stringify(components)}
  let current_component = null
  let current_story = null
  let dark = false

  const filter_input = document.getElementById('filter')
  const tree = document.getElementById('tree')
  const preview = document.getElementById('preview')
  const toolbar_path = document.getElementById('toolbar-path')
  const flavor_select = document.getElementById('flavor-select')
  const dark_toggle = document.getElementById('dark-toggle')

  filter_input.addEventListener('input', () => {
    const query = filter_input.value.toLowerCase()
    tree.querySelectorAll('.component').forEach(el => {
      const name = el.dataset.path.toLowerCase()
      const match = !query || name.includes(query)
      el.classList.toggle('hidden', !match)
    })
    tree.querySelectorAll('.directory').forEach(el => {
      const section = el.nextElementSibling
      if (!section) return
      const visible = section.querySelectorAll('.component:not(.hidden)')
      el.classList.toggle('hidden', visible.length === 0)
    })
  })

  function selectStory(component_path, story_name) {
    document.querySelectorAll('.story-link.active').forEach(el => el.classList.remove('active'))

    const link = document.querySelector('[data-component="' + component_path + '"][data-story="' + story_name + '"]')
    if (link) link.classList.add('active')

    const component_el = link?.closest('.component')
    if (component_el) component_el.classList.add('open')

    current_component = component_path
    current_story = story_name

    const comp = components.find(c => c.component_path === component_path)
    if (comp && comp.flavor_names.length > 0) {
      flavor_select.classList.remove('hidden')
      flavor_select.innerHTML = comp.flavor_names.map(f =>
        '<option value="' + f + '">' + f + '</option>'
      ).join('')
    } else {
      flavor_select.classList.add('hidden')
    }

    toolbar_path.textContent = component_path + ' / ' + story_name

    loadStory()
  }

  function loadStory() {
    if (!current_component || !current_story) return

    const is_page = current_component.includes('+page') || current_component.includes('+layout')
    const params = new URLSearchParams({
      component: current_component,
      story: current_story,
      is_page: String(is_page),
    })

    const comp = components.find(c => c.component_path === current_component)
    if (comp && comp.flavor_names.length > 0) {
      params.set('flavor', flavor_select.value)
    }

    ${config.mocks ? `params.set('mocks', '${config.mocks}')` : ''}

    let url = '/__svelte-look__/mount?' + params.toString()
    if (dark) url += '&dark=1'

    preview.src = url
  }

  function toggleDark() {
    dark = !dark
    if (dark_toggle) dark_toggle.classList.toggle('active', dark)
    document.querySelector('.layout').classList.toggle('dark-mode', dark)
    loadStory()
  }

  function openInNewTab() {
    if (preview.src) window.open(preview.src, '_blank')
  }

  document.querySelectorAll('.component-name').forEach(el => {
    el.addEventListener('click', () => {
      el.parentElement.classList.toggle('open')
    })
  })
</script>
</body>
</html>`
}

interface GroupedComponents {
  [directory: string]: ComponentInfo[]
}

function group_by_directory(components: ComponentInfo[]): GroupedComponents {
  const grouped: GroupedComponents = {}
  for (const comp of components) {
    const parts = comp.component_path.split('/')
    const directory = parts.slice(1, -1).join('/')
    if (!grouped[directory]) grouped[directory] = []
    grouped[directory].push(comp)
  }
  return grouped
}

function render_tree(grouped: GroupedComponents): string {
  return Object.entries(grouped).map(([directory, components]) => {
    const component_html = components.map(comp => {
      const name = comp.component_path.split('/').pop()
      const stories_html = comp.stories.map(story =>
        `<a class="story-link" data-component="${comp.component_path}" data-story="${story}" onclick="selectStory('${comp.component_path}', '${story}')">${story}</a>`
      ).join('\n')

      return `<div class="component" data-path="${comp.component_path}">
        <div class="component-name"><span class="arrow">\u{25B6}</span> ${name}</div>
        <div class="stories">${stories_html}</div>
      </div>`
    }).join('\n')

    return `<div class="directory">${directory}</div>\n<div>${component_html}</div>`
  }).join('\n')
}
