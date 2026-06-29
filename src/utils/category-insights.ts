import type { CollectionEntry } from 'astro:content'

import { buildBacklinksMap, getBacklinksForPost, getOutgoingLinks } from '@/utils/backlinks'
import {
  getAllCategories,
  getCategoryLabel,
  getPostCategory,
  getPostPath,
  getPostSlug
} from '@/utils/content-paths'

type BlogPost = CollectionEntry<'blog'>

export interface CategoryRelation {
  path: string
  label: string
  score: number
  sharedTags: string[]
  crossLinks: number
}

export interface LinkInsight {
  sourceTitle: string
  targetTitle: string
  locateHref: string
}

export interface CategoryInsight {
  path: string
  label: string
  totalPosts: number
  directPosts: number
  childCategories: number
  inboundLinks: number
  outboundLinks: number
  inboundLinkDetails: LinkInsight[]
  outboundLinkDetails: LinkInsight[]
  orphanPosts: number
  topTags: Array<{ name: string; count: number }>
  recentPosts: Array<{ title: string; href: string; date: string }>
  relatedCategories: CategoryRelation[]
}

export interface PostInsight {
  id: string
  type: 'post'
  title: string
  description: string
  href: string
  category?: string
  categoryLabel?: string
  date: string
  tags: string[]
  inboundLinks: number
  outboundLinks: number
  inboundLinkDetails: LinkInsight[]
  outboundLinkDetails: LinkInsight[]
}

function postDate(post: BlogPost): Date {
  return post.data.updatedDate ?? post.data.publishDate
}

function countTags(posts: BlogPost[]) {
  const counts = new Map<string, number>()
  posts.forEach((post) => {
    post.data.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))
  })
  return counts
}

function leafCategory(post: BlogPost): string | undefined {
  return getPostCategory(post)
}

export async function buildCategoryInsights(posts: BlogPost[]) {
  const categoryMap = getAllCategories(posts)
  const backlinksMap = await buildBacklinksMap(posts)
  const postById = new Map(posts.map((post) => [post.id, post]))
  const outgoingById = new Map(posts.map((post) => [post.id, getOutgoingLinks(post, posts)]))
  const backlinksById = new Map(
    posts.map((post) => [post.id, getBacklinksForPost(backlinksMap, post.id)])
  )
  const categoryTagCounts = new Map(
    [...categoryMap].map(([path, categoryPosts]) => [path, countTags(categoryPosts)])
  )

  const insights = new Map<string, CategoryInsight>()

  for (const [path, categoryPosts] of categoryMap) {
    const directPosts = categoryPosts.filter((post) => leafCategory(post) === path)
    const childCategories = [...categoryMap.keys()].filter((candidate) => {
      if (!candidate.startsWith(`${path}/`)) return false
      return candidate.slice(path.length + 1).split('/').length === 1
    }).length
    const topTags = [...(categoryTagCounts.get(path) ?? new Map())]
      .sort(([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB))
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    let inboundLinks = 0
    let outboundLinks = 0
    let orphanPosts = 0
    const crossLinksByCategory = new Map<string, number>()
    const inboundLinkDetails: LinkInsight[] = []
    const outboundLinkDetails: LinkInsight[] = []

    categoryPosts.forEach((post) => {
      const outgoing = outgoingById.get(post.id) ?? []
      const backlinks = backlinksById.get(post.id) ?? []
      inboundLinks += backlinks.length
      outboundLinks += outgoing.length
      if (outgoing.length === 0 && backlinks.length === 0) orphanPosts += 1

      outgoing.forEach((link) => {
        const targetPost = postById.get(link.id)
        if (targetPost) {
          outboundLinkDetails.push({
            sourceTitle: post.data.title,
            targetTitle: targetPost.data.title,
            locateHref: `${getPostPath(post)}?locate=${encodeURIComponent(getPostSlug(targetPost))}`
          })
        }
        const targetCategory = targetPost && leafCategory(targetPost)
        if (!targetCategory || targetCategory === path || targetCategory.startsWith(`${path}/`)) {
          return
        }
        crossLinksByCategory.set(
          targetCategory,
          (crossLinksByCategory.get(targetCategory) ?? 0) + 1
        )
      })

      backlinks.forEach((backlink) => {
        inboundLinkDetails.push({
          sourceTitle: backlink.title,
          targetTitle: post.data.title,
          locateHref: `${backlink.url}?locate=${encodeURIComponent(getPostSlug(post))}`
        })
      })
    })

    const currentTags = categoryTagCounts.get(path) ?? new Map()
    const relatedCategories = [...categoryMap.keys()]
      .filter(
        (candidate) =>
          candidate !== path &&
          !candidate.startsWith(`${path}/`) &&
          !path.startsWith(`${candidate}/`)
      )
      .map((candidate) => {
        const candidateTags = categoryTagCounts.get(candidate) ?? new Map()
        const sharedTags = [...currentTags.keys()]
          .filter((tag) => candidateTags.has(tag))
          .sort(
            (a, b) =>
              Math.min(candidateTags.get(b) ?? 0, currentTags.get(b) ?? 0) -
                Math.min(candidateTags.get(a) ?? 0, currentTags.get(a) ?? 0) || a.localeCompare(b)
          )
          .slice(0, 4)
        const sharedWeight = sharedTags.reduce(
          (total, tag) => total + Math.min(currentTags.get(tag) ?? 0, candidateTags.get(tag) ?? 0),
          0
        )
        const crossLinks = crossLinksByCategory.get(candidate) ?? 0

        return {
          path: candidate,
          label: getCategoryLabel(candidate.split('/').at(-1) ?? candidate),
          score: sharedWeight + crossLinks * 3,
          sharedTags,
          crossLinks
        }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, 5)

    insights.set(path, {
      path,
      label: getCategoryLabel(path.split('/').at(-1) ?? path),
      totalPosts: categoryPosts.length,
      directPosts: directPosts.length,
      childCategories,
      inboundLinks,
      outboundLinks,
      inboundLinkDetails,
      outboundLinkDetails,
      orphanPosts,
      topTags,
      recentPosts: [...categoryPosts]
        .sort((a, b) => postDate(b).valueOf() - postDate(a).valueOf())
        .slice(0, 5)
        .map((post) => ({
          title: post.data.title,
          href: getPostPath(post),
          date: postDate(post).toISOString()
        })),
      relatedCategories
    })
  }

  const postInsights = new Map<string, PostInsight>(
    posts.map((post) => {
      const category = leafCategory(post)
      const inboundLinkDetails = (backlinksById.get(post.id) ?? []).map((backlink) => ({
        sourceTitle: backlink.title,
        targetTitle: post.data.title,
        locateHref: `${backlink.url}?locate=${encodeURIComponent(getPostSlug(post))}`
      }))
      const outboundLinkDetails = (outgoingById.get(post.id) ?? [])
        .map((link) => {
          const targetPost = postById.get(link.id)
          if (!targetPost) return undefined
          return {
            sourceTitle: post.data.title,
            targetTitle: targetPost.data.title,
            locateHref: `${getPostPath(post)}?locate=${encodeURIComponent(getPostSlug(targetPost))}`
          }
        })
        .filter((detail): detail is LinkInsight => Boolean(detail))

      return [
        post.id,
        {
          id: post.id,
          type: 'post',
          title: post.data.title,
          description: post.data.description,
          href: getPostPath(post),
          category,
          categoryLabel: category
            ? getCategoryLabel(category.split('/').at(-1) ?? category)
            : undefined,
          date: postDate(post).toISOString(),
          tags: post.data.tags,
          inboundLinks: backlinksById.get(post.id)?.length ?? 0,
          outboundLinks: outgoingById.get(post.id)?.length ?? 0,
          inboundLinkDetails,
          outboundLinkDetails
        }
      ]
    })
  )

  return { insights, postInsights }
}
