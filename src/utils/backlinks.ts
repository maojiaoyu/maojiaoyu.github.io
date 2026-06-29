import fs from 'node:fs'
import path from 'node:path'

/**
 * Backlinks utility - collects and manages backlinks between blog posts
 */

// Regex patterns for link detection
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g
const RELATIVE_LINK_REGEX = /\(\.\/([^)]+)\)/g

export interface Backlink {
  /** The ID/slug of the linking post */
  id: string
  /** The title of the linking post */
  title: string
  /** A snippet of text around the link */
  context?: string
  /** The URL to the linking post */
  url: string
  /** The publish date of the linking post */
  date?: Date
}

export interface BacklinksMap {
  [targetId: string]: Backlink[]
}

/** Minimal post interface for backlinks processing */
interface PostLike {
  id: string
  body?: string
  filePath?: string
  data: {
    title: string
    publishDate?: Date
    slug?: string
  }
}

/**
 * Get content from post, reading from file if body is missing
 */
function getPostContent(post: PostLike): string {
  if (post.body) return post.body

  // Try to read from file if filePath is available (Astro 5+ loader)
  if (post.filePath) {
    try {
      return fs.readFileSync(path.resolve(post.filePath), 'utf-8')
    } catch (e) {
      return ''
    }
  }

  // Fallback for default content collection structure
  try {
    const blogPath = path.resolve('src/content/blog', post.id)
    if (fs.existsSync(blogPath)) return fs.readFileSync(blogPath, 'utf-8')
    if (fs.existsSync(blogPath + '.md')) return fs.readFileSync(blogPath + '.md', 'utf-8')
    if (fs.existsSync(blogPath + '.mdx')) return fs.readFileSync(blogPath + '.mdx', 'utf-8')
  } catch (e) {}

  return ''
}

/**
 * Normalize a slug/id for comparison
 */
function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .split('#', 1)[0]
    .split('?', 1)[0]
    .replace(/\s+/g, '-')
    .replace(/\.(md|mdx)$/, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/index$/, '')
}

function dirname(id: string): string {
  const index = id.lastIndexOf('/')
  return index === -1 ? '' : id.slice(0, index)
}

function normalizePath(path: string): string {
  const parts: string[] = []

  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
    } else {
      parts.push(part)
    }
  }

  return parts.join('/')
}

function getCanonicalSlug(post: PostLike): string {
  if (post.data.slug) return normalizeId(post.data.slug)

  return normalizeId(post.id)
}

/**
 * Resolve a wikilink target against collection IDs.
 *
 * Bare filenames are resolved relative to the source post first, then by a
 * unique filename match. This keeps Obsidian-style links concise while routes
 * continue to use the full collection ID, such as `flash/post-name`.
 */
export function resolveContentId(
  target: string,
  sourceId: string,
  validIds: Iterable<string>
): string | undefined {
  const normalizedTarget = normalizeId(target.replace(/^\/?(?:blog|docs)\//, ''))
  const normalizedSource = normalizeId(sourceId)
  const ids = [...validIds].map(normalizeId)
  const validIdSet = new Set(ids)

  if (validIdSet.has(normalizedTarget)) return normalizedTarget

  const relativeTarget = normalizePath(`${dirname(normalizedSource)}/${normalizedTarget}`)
  if (validIdSet.has(relativeTarget)) return relativeTarget

  if (!normalizedTarget.includes('/')) {
    const filenameMatches = ids.filter(
      (id) => id === normalizedTarget || id.endsWith(`/${normalizedTarget}`)
    )
    if (filenameMatches.length === 1) return filenameMatches[0]
  }

  return undefined
}

/**
 * Extract all links from post content (body)
 */
function extractLinksFromContent(content: string, basePath: string): string[] {
  const links: string[] = []

  // Extract wikilinks [[link]]
  const wikiMatches = content.matchAll(WIKILINK_REGEX)
  for (const match of wikiMatches) {
    let slug = match[1].trim()
    // Remove ./ prefix if present
    if (slug.startsWith('./')) {
      slug = slug.slice(2)
    }
    links.push(normalizeId(slug))
  }

  // Extract relative markdown links (./slug)
  const relativeMatches = content.matchAll(RELATIVE_LINK_REGEX)
  for (const match of relativeMatches) {
    links.push(normalizeId(match[1]))
  }

  // Extract standard markdown links that point to the current collection.
  const mdMatches = content.matchAll(MARKDOWN_LINK_REGEX)
  for (const match of mdMatches) {
    const url = match[2]
    const pathPrefix = `${basePath.replace(/\/$/, '')}/`
    if (url.startsWith(pathPrefix) || url.includes(pathPrefix)) {
      const slug = url.replace(new RegExp(`^.*${escapeRegex(pathPrefix)}`), '').replace(/\/$/, '')
      if (slug) {
        links.push(normalizeId(slug))
      }
    }
  }

  return [...new Set(links)] // Remove duplicates
}

/**
 * Get a context snippet around a link
 */
function getContextSnippet(
  content: string,
  targetSlug: string,
  maxLength: number = 100
): string | undefined {
  // Try to find wikilink first
  const wikilinkPattern = new RegExp(`\\[\\[${escapeRegex(targetSlug)}(?:\\|[^\\]]+)?\\]\\]`, 'i')
  let match = wikilinkPattern.exec(content)

  // Try relative link
  if (!match) {
    const relativePattern = new RegExp(`\\(\\./${escapeRegex(targetSlug)}\\)`, 'i')
    match = relativePattern.exec(content)
  }

  if (!match) return undefined

  const start = Math.max(0, match.index - 50)
  const end = Math.min(content.length, match.index + match[0].length + 50)

  let snippet = content.slice(start, end)

  // Clean up the snippet
  snippet = snippet.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'

  return snippet.slice(0, maxLength)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a backlinks map from a collection of posts
 * @param posts - Array of blog posts
 * @param basePath - Base URL path for blog posts
 * @returns A map of target post IDs to their backlinks
 */
export async function buildBacklinksMap(
  posts: PostLike[],
  basePath: string = '/blog'
): Promise<BacklinksMap> {
  const backlinksMap: BacklinksMap = {}

  // Initialize empty arrays for all posts
  for (const post of posts) {
    const normalizedId = normalizeId(post.id)
    backlinksMap[normalizedId] = []
  }

  // Build map of valid slugs
  const validSlugs = new Set(posts.map((p) => normalizeId(p.id)))

  // Process each post to find outgoing links
  for (const post of posts) {
    const sourceId = normalizeId(post.id)
    const content = post.body || ''

    // Extract all links from this post
    const links = extractLinksFromContent(content, basePath)

    for (const link of links) {
      const targetSlug = resolveContentId(link, sourceId, validSlugs)
      if (!targetSlug) continue

      // Skip self-references
      if (targetSlug === sourceId) continue

      // Only add backlink if target exists
      if (validSlugs.has(targetSlug)) {
        if (!backlinksMap[targetSlug]) {
          backlinksMap[targetSlug] = []
        }

        // Avoid duplicate backlinks
        const exists = backlinksMap[targetSlug].some((bl) => bl.id === sourceId)
        if (!exists) {
          backlinksMap[targetSlug].push({
            id: sourceId,
            title: post.data.title,
            context: getContextSnippet(content, targetSlug),
            url: `${basePath}/${basePath === '/docs' ? normalizeId(post.id) : getCanonicalSlug(post)}`,
            date: post.data.publishDate
          })
        }
      }
    }
  }

  return backlinksMap
}

/**
 * Get backlinks for a specific post
 */
export function getBacklinksForPost(backlinksMap: BacklinksMap, postId: string): Backlink[] {
  const normalizedId = normalizeId(postId)
  return backlinksMap[normalizedId] || []
}

/**
 * Get all posts that the current post links to (outgoing links)
 */
export function getOutgoingLinks(
  post: PostLike,
  posts: PostLike[],
  basePath: string = '/blog'
): Backlink[] {
  const content = getPostContent(post)
  const links = extractLinksFromContent(content, basePath)
  const validPosts = new Map(posts.map((p) => [normalizeId(p.id), p]))

  const outgoing: Backlink[] = []
  const seen = new Set<string>()

  for (const link of links) {
    const targetSlug = resolveContentId(link, post.id, validPosts.keys())
    if (!targetSlug) continue

    if (seen.has(targetSlug)) continue
    seen.add(targetSlug)

    const targetPost = validPosts.get(targetSlug)
    if (targetPost) {
      outgoing.push({
        id: targetSlug,
        title: targetPost.data.title,
        url: `${basePath}/${
          basePath === '/docs' ? normalizeId(targetPost.id) : getCanonicalSlug(targetPost)
        }`,
        date: targetPost.data.publishDate
      })
    }
  }

  return outgoing
}
