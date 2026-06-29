import type * as D3 from 'd3'

interface RelatedTag {
  name: string
  count: number
}

interface RelatedPost {
  id: string
  href: string
  title: string
  tags: string[]
}

interface GraphData {
  tag: string
  relatedTags: RelatedTag[]
  posts: RelatedPost[]
}

interface GraphNode extends D3.SimulationNodeDatum {
  id: string
  label: string
  type: 'current' | 'post' | 'tag'
  href: string
  radius: number
}

interface GraphLink extends D3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

const initialized = new WeakSet<HTMLElement>()

function buildGraphData(data: GraphData) {
  const relatedNames = new Set(data.relatedTags.map(({ name }) => name))
  const nodes: GraphNode[] = [
    {
      id: `tag:${data.tag}`,
      label: `#${data.tag}`,
      type: 'current',
      href: `/tags/${encodeURIComponent(data.tag)}`,
      radius: 18
    }
  ]
  const links: GraphLink[] = []

  data.posts.slice(0, 12).forEach((post) => {
    const postId = `post:${post.id}`
    nodes.push({
      id: postId,
      label: post.title,
      type: 'post',
      href: post.href,
      radius: 8
    })
    links.push({ source: `tag:${data.tag}`, target: postId })
  })

  data.relatedTags.slice(0, 10).forEach(({ name, count }) => {
    nodes.push({
      id: `tag:${name}`,
      label: `#${name}`,
      type: 'tag',
      href: `/tags/${encodeURIComponent(name)}`,
      radius: Math.min(14, 8 + Math.sqrt(count) * 2)
    })
  })

  data.posts.slice(0, 12).forEach((post) => {
    post.tags.forEach((postTag) => {
      if (postTag !== data.tag && relatedNames.has(postTag)) {
        links.push({ source: `post:${post.id}`, target: `tag:${postTag}` })
      }
    })
  })

  return { nodes, links }
}

async function renderGraph(root: HTMLElement, data: GraphData) {
  const canvas = root.querySelector<HTMLElement>('[data-tag-graph-canvas]')
  if (!canvas || canvas.dataset.rendered === 'true') return

  const status = canvas.querySelector<HTMLElement>('[data-tag-graph-status]')

  try {
    const d3 = await import('d3')
    const { nodes, links } = buildGraphData(data)
    const width = canvas.clientWidth || 800
    const height = canvas.clientHeight || 420

    status?.remove()
    canvas.dataset.rendered = 'true'

    const svg = d3
      .select(canvas)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Relationship graph for ${data.tag}`)

    const viewport = svg.append('g')
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.55, 2.5])
      .on('zoom', (event) => viewport.attr('transform', event.transform))

    svg.call(zoom)

    const link = viewport
      .append('g')
      .attr('stroke', 'hsl(var(--muted-foreground) / 0.28)')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1)

    const node = viewport
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
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

    node
      .append('circle')
      .attr('r', (item) => item.radius)
      .attr('fill', (item) => {
        if (item.type === 'current') return 'hsl(var(--primary))'
        if (item.type === 'tag') return 'hsl(var(--background))'
        return 'hsl(var(--muted-foreground) / 0.68)'
      })
      .attr('stroke', (item) =>
        item.type === 'post' ? 'hsl(var(--background))' : 'hsl(var(--primary) / 0.75)'
      )
      .attr('stroke-width', (item) => (item.type === 'current' ? 3 : 2))

    node
      .append('text')
      .attr('x', (item) => item.radius + 5)
      .attr('y', 4)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('font-size', (item) => (item.type === 'post' ? 10 : 11))
      .attr('font-weight', (item) => (item.type === 'current' ? 650 : 500))
      .text((item) => item.label)
      .style('pointer-events', 'none')

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((item) => item.id)
          .distance((item) => {
            const target = item.target as GraphNode
            return target.type === 'tag' ? 82 : 68
          })
          .strength(0.75)
      )
      .force('charge', d3.forceManyBody().strength(-230))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide<GraphNode>().radius((item) => item.radius + 22)
      )
      .on('tick', () => {
        link
          .attr('x1', (item) => (item.source as GraphNode).x ?? 0)
          .attr('y1', (item) => (item.source as GraphNode).y ?? 0)
          .attr('x2', (item) => (item.target as GraphNode).x ?? 0)
          .attr('y2', (item) => (item.target as GraphNode).y ?? 0)

        node.attr('transform', (item) => `translate(${item.x ?? 0},${item.y ?? 0})`)
      })

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, item) => {
        if (!event.active) simulation.alphaTarget(0.25).restart()
        item.fx = item.x
        item.fy = item.y
      })
      .on('drag', (event, item) => {
        item.fx = event.x
        item.fy = event.y
      })
      .on('end', (event, item) => {
        if (!event.active) simulation.alphaTarget(0)
        item.fx = null
        item.fy = null
      })

    node.call(drag)
  } catch (error) {
    console.error('Failed to render tag relationship graph:', error)
    if (status) status.textContent = 'Unable to load the graph.'
  }
}

export function setupTagRelations() {
  document.querySelectorAll<HTMLElement>('[data-tag-relations]').forEach((root) => {
    if (initialized.has(root)) return

    const toggle = root.querySelector<HTMLButtonElement>('[data-tag-graph-toggle]')
    const graph = root.querySelector<HTMLElement>('[data-tag-graph]')
    const dataElement = root.querySelector<HTMLScriptElement>('[data-tag-graph-data]')
    const label = root.querySelector<HTMLElement>('[data-toggle-label]')
    if (!toggle || !graph || !dataElement) return

    const data = JSON.parse(dataElement.textContent || '{}') as GraphData

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true'
      toggle.setAttribute('aria-expanded', String(!expanded))
      graph.hidden = expanded
      if (label) label.textContent = expanded ? 'View graph' : 'Hide graph'

      if (!expanded) {
        requestAnimationFrame(() => renderGraph(root, data))
      }
    })

    initialized.add(root)
  })
}

setupTagRelations()
document.addEventListener('astro:page-load', setupTagRelations)
