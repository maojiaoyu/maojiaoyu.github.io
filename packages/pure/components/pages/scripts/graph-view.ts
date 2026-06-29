import * as d3 from 'd3'

interface ContentDetails {
  slug: string
  aliases: string[]
  title: string
  tags: string[]
  categories: string[]
  links: string[]
  collection: 'blog' | 'docs'
}

interface ContentIndex {
  [slug: string]: ContentDetails
}

type NodeKind = 'content' | 'tag' | 'category'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  href: string
  kind: NodeKind
  current: boolean
  degree: number
  radius: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface RenderOptions {
  global: boolean
  reset?: HTMLButtonElement | null
  currentSlug?: string | null
}

const initialized = new WeakSet<HTMLElement>()
let contentIndexPromise: Promise<ContentIndex> | null = null

function loadContentIndex() {
  contentIndexPromise ??= (async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch('/contentIndex.json', { signal: controller.signal })
      if (!response.ok) throw new Error('Failed to load content index')
      return (await response.json()) as ContentIndex
    } catch (error) {
      contentIndexPromise = null
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  })()
  return contentIndexPromise
}

function normalizeSlug(index: ContentIndex, value: string) {
  let slug = value.replace(/^\//, '').replace(/\/$/, '').split('#')[0]
  if (!slug.startsWith('blog/') && !slug.startsWith('docs/') && !slug.includes('/')) {
    slug = `blog/${slug}`
  }
  if (index[slug]) return slug
  return Object.values(index).find(({ aliases }) => aliases?.includes(slug))?.slug ?? slug
}

function buildGraph(index: ContentIndex, currentSlug: string | null, global: boolean): GraphData {
  const nodes = new Map<string, GraphNode>()
  const links = new Map<string, GraphLink>()
  const neighbours = new Set<string>(currentSlug ? [currentSlug] : [])

  if (!global && currentSlug) {
    const current = index[currentSlug]
    current?.links.forEach((link) => neighbours.add(normalizeSlug(index, link)))
    Object.entries(index).forEach(([slug, details]) => {
      if (details.links.some((link) => normalizeSlug(index, link) === currentSlug)) {
        neighbours.add(slug)
      }
    })

    if (currentSlug.startsWith('docs/')) {
      const section = currentSlug.split('/').slice(0, -1).join('/')
      Object.keys(index).forEach((slug) => {
        if (
          slug.startsWith(`${section}/`) &&
          slug.split('/').length === currentSlug.split('/').length
        ) {
          neighbours.add(slug)
        }
      })
    }
  }

  const includeContent = (slug: string) => global || !currentSlug || neighbours.has(slug)
  const addNode = (node: Omit<GraphNode, 'degree' | 'radius'>) => {
    if (!nodes.has(node.id)) nodes.set(node.id, { ...node, degree: 0, radius: 7 })
  }
  const addLink = (source: string, target: string) => {
    if (source === target) return
    const key = [source, target].sort().join('::')
    if (!links.has(key)) links.set(key, { source, target })
  }

  Object.entries(index).forEach(([slug, details]) => {
    if (!includeContent(slug)) return
    addNode({
      id: slug,
      label: details.title,
      href: `/${slug}`,
      kind: 'content',
      current: slug === currentSlug
    })

    details.links.forEach((rawTarget) => {
      const target = normalizeSlug(index, rawTarget)
      if (!index[target] || !includeContent(target)) return
      const targetDetails = index[target]
      addNode({
        id: target,
        label: targetDetails.title,
        href: `/${target}`,
        kind: 'content',
        current: target === currentSlug
      })
      addLink(slug, target)
    })

    details.tags.forEach((tag) => {
      const id = `tag:${tag}`
      addNode({
        id,
        label: `#${tag}`,
        href: `/tags/${encodeURIComponent(tag)}`,
        kind: 'tag',
        current: false
      })
      addLink(slug, id)
    })

    details.categories.forEach((category) => {
      const id = `category:${category}`
      addNode({
        id,
        label: category.split('/').at(-1) || category,
        href: `/categories/${category}`,
        kind: 'category',
        current: false
      })
      addLink(slug, id)
    })

    if (details.collection === 'docs') {
      const section = slug.split('/').slice(0, -1).join('/')
      if (section !== 'docs') {
        const id = `section:${section}`
        addNode({
          id,
          label: section.split('/').at(-1) || '文档',
          href: '/docs',
          kind: 'category',
          current: false
        })
        addLink(slug, id)
      }
    }
  })

  links.forEach(({ source, target }) => {
    const sourceNode = nodes.get(String(source))
    const targetNode = nodes.get(String(target))
    if (sourceNode) sourceNode.degree += 1
    if (targetNode) targetNode.degree += 1
  })
  nodes.forEach((node) => {
    node.radius = Math.min(global ? 15 : 13, 6 + Math.sqrt(node.degree) * 2)
    if (node.current) node.radius += 2
  })

  return { nodes: [...nodes.values()], links: [...links.values()] }
}

function renderGraph(canvas: HTMLElement, data: GraphData, options: RenderOptions) {
  d3.select(canvas).selectAll('*').remove()
  const width = canvas.clientWidth || (options.global ? 1000 : 680)
  const height = canvas.clientHeight || (options.global ? 620 : 380)
  const neighbours = new Map<string, Set<string>>()
  const currentNode = data.nodes.find((node) => node.id === options.currentSlug)

  if (options.global && currentNode) {
    currentNode.fx = width / 2
    currentNode.fy = height / 2
    currentNode.x = width / 2
    currentNode.y = height / 2
  }

  data.links.forEach(({ source, target }) => {
    const sourceId = String(source)
    const targetId = String(target)
    if (!neighbours.has(sourceId)) neighbours.set(sourceId, new Set())
    if (!neighbours.has(targetId)) neighbours.set(targetId, new Set())
    neighbours.get(sourceId)?.add(targetId)
    neighbours.get(targetId)?.add(sourceId)
  })

  const svg = d3
    .select(canvas)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', options.global ? '全局知识图谱' : '当前内容知识图谱')
  const viewport = svg.append('g')
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.35, 3])
    .on('zoom', (event) => viewport.attr('transform', event.transform))
  svg.call(zoom)

  const link = viewport
    .append('g')
    .selectAll<SVGLineElement, GraphLink>('line')
    .data(data.links)
    .join('line')
    .attr('stroke', 'hsl(var(--primary) / 0.24)')
    .attr('stroke-width', options.global ? 0.85 : 1)

  const node = viewport
    .append('g')
    .selectAll<SVGGElement, GraphNode>('g')
    .data(data.nodes)
    .join('g')
    .attr('tabindex', 0)
    .attr('role', 'link')
    .attr('aria-label', (item) => item.label)
    .style('cursor', 'pointer')
    .on('click', (_event, item) => {
      window.location.href = item.href
    })
    .on('keydown', (event: KeyboardEvent, item) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        window.location.href = item.href
      }
    })

  const circles = node
    .append('circle')
    .attr('r', (item) => item.radius)
    .attr('fill', (item) =>
      item.current
        ? 'hsl(var(--primary))'
        : item.kind === 'content'
          ? 'hsl(var(--background))'
          : 'hsl(var(--primary) / 0.12)'
    )
    .attr('stroke', (item) => (item.current ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.78)'))
    .attr('stroke-width', (item) => (item.current ? 3 : item.kind === 'content' ? 1.6 : 1.3))

  node
    .filter((item) => item.kind !== 'content')
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', 'hsl(var(--primary))')
    .attr('font-size', (item) => Math.max(8, item.radius * 0.8))
    .attr('font-weight', 700)
    .text((item) => (item.kind === 'tag' ? '#' : '·'))
    .style('pointer-events', 'none')

  const labels = node
    .append('text')
    .attr('x', (item) => item.radius + 5)
    .attr('y', 4)
    .attr('fill', 'hsl(var(--foreground))')
    .attr('font-size', options.global ? 9 : 10)
    .attr('font-weight', (item) => (item.current ? 650 : 480))
    .text((item) => item.label)
    .style('pointer-events', 'none')

  const focus = (focused: GraphNode | null) => {
    const connected = focused ? (neighbours.get(focused.id) ?? new Set<string>()) : null
    const visible = (item: GraphNode) =>
      !focused || item.id === focused.id || connected?.has(item.id)

    circles.attr('opacity', (item) => (visible(item) ? 1 : 0.16))
    labels.attr('opacity', (item) => (visible(item) ? 1 : 0.12))
    link
      .attr('stroke', (item) => {
        const source = item.source as GraphNode
        const target = item.target as GraphNode
        return focused && (source.id === focused.id || target.id === focused.id)
          ? 'hsl(var(--primary) / 0.82)'
          : 'hsl(var(--primary) / 0.22)'
      })
      .attr('opacity', (item) => {
        if (!focused) return 1
        const source = item.source as GraphNode
        const target = item.target as GraphNode
        return source.id === focused.id || target.id === focused.id ? 1 : 0.06
      })
  }
  node
    .on('mouseenter', (_event, item) => focus(item))
    .on('mouseleave', () => focus(null))
    .on('focus', (_event, item) => focus(item))
    .on('blur', () => focus(null))

  const simulation = d3
    .forceSimulation<GraphNode>(data.nodes)
    .alphaDecay(options.global ? 0.08 : 0.045)
    .velocityDecay(options.global ? 0.5 : 0.4)
    .force(
      'link',
      d3
        .forceLink<GraphNode, GraphLink>(data.links)
        .id((item) => item.id)
        .distance(options.global ? 58 : 72)
        .strength(0.48)
    )
    .force('charge', d3.forceManyBody().strength(options.global ? -105 : -150))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.035))
    .force('y', d3.forceY(height / 2).strength(0.035))
    .force(
      'collide',
      d3.forceCollide<GraphNode>().radius((item) => item.radius + (options.global ? 11 : 15))
    )
    .force(
      'radial',
      options.global && currentNode
        ? d3
            .forceRadial<GraphNode>((item) => (item.current ? 0 : Math.min(width, height) * 0.28))
            .x(width / 2)
            .y(height / 2)
            .strength((item) => (item.current ? 1 : 0.035))
        : null
    )
    .on('tick', () => {
      link
        .attr('x1', (item) => (item.source as GraphNode).x ?? 0)
        .attr('y1', (item) => (item.source as GraphNode).y ?? 0)
        .attr('x2', (item) => (item.target as GraphNode).x ?? 0)
        .attr('y2', (item) => (item.target as GraphNode).y ?? 0)
      node.attr('transform', (item) => `translate(${item.x ?? 0},${item.y ?? 0})`)
    })

  node.call(
    d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, item) => {
        if (!event.active) simulation.alphaTarget(0.2).restart()
        item.fx = item.x
        item.fy = item.y
      })
      .on('drag', (event, item) => {
        item.fx = event.x
        item.fy = event.y
      })
      .on('end', (event, item) => {
        if (!event.active) simulation.alphaTarget(0)
        if (!(options.global && item.current)) {
          item.fx = null
          item.fy = null
        }
      })
  )

  options.reset?.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
    if (options.global && currentNode) {
      currentNode.fx = width / 2
      currentNode.fy = height / 2
    }
    simulation.alpha(0.45).restart()
  })
}

async function setupGraphView(root: HTMLElement) {
  if (initialized.has(root)) return

  const canvas = root.querySelector<HTMLElement>('[data-graph-canvas]')
  const status = root.querySelector<HTMLElement>('[data-graph-status]')
  const stats = root.querySelector<HTMLElement>('[data-graph-stats]')
  const reset = root.querySelector<HTMLButtonElement>('[data-graph-reset]')
  if (!canvas) return
  initialized.add(root)

  try {
    const index = await loadContentIndex()
    if (!root.isConnected) return

    const currentSlug = root.dataset.currentSlug || null
    const localData = buildGraph(index, currentSlug, false)
    status?.remove()
    if (stats) stats.textContent = `${localData.nodes.length} 节点 · ${localData.links.length} 连线`
    renderGraph(canvas, localData, { global: false, reset, currentSlug })
  } catch (error) {
    console.error('Failed to render graph view:', error)
    if (root.isConnected && status) status.textContent = '知识图谱暂时无法加载，请刷新重试。'
  }
}

export function initGraphView() {
  document.querySelectorAll<HTMLElement>('[data-graph-view]').forEach((root) => {
    setupGraphView(root)
  })
}

initGraphView()
document.addEventListener('astro:after-swap', initGraphView)
document.addEventListener('astro:page-load', initGraphView)
