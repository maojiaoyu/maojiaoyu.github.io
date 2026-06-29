interface Config {
  private_api_url: string
  page_turning_number: number
  error_img: string
}

interface Article {
  title: string
  link: string | URL
  avatar: string
  author: string
  created: string
}

interface ArticleData {
  article_data: Article[]
  statistical_data: {
    friends_num: number
    active_num: number
    article_num: number
    last_updated_time: string
  }
}

export class FriendCircle {
  config!: Config
  root!: HTMLElement
  allArticles: Article[] = []
  visibleCount = 0
  container!: HTMLElement
  randomArticleContainer!: HTMLElement
  statsContainer!: HTMLElement
  controlsContainer!: HTMLElement
  loadMoreBtn!: HTMLButtonElement
  collapseBtn!: HTMLButtonElement
  endMessage!: HTMLElement
  modal!: HTMLElement
  listenerController?: AbortController

  load() {
    this.listenerController?.abort()
    this.listenerController = new AbortController()
    const { signal } = this.listenerController

    void this.loadArticles()
    this.loadMoreBtn.addEventListener(
      'click',
      () => {
        const start = this.visibleCount
        this.visibleCount = Math.min(
          this.visibleCount + this.config.page_turning_number,
          this.allArticles.length
        )
        this.renderArticles(start)

        setTimeout(() => {
          this.controlsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }, 100)
      },
      { signal }
    )
    this.collapseBtn.addEventListener(
      'click',
      () => {
        this.visibleCount = Math.min(this.config.page_turning_number, this.allArticles.length)
        this.renderArticles(0, true)
        this.root.scrollIntoView({ behavior: 'smooth', block: 'center' })
      },
      { signal }
    )
    window.addEventListener(
      'click',
      (event) => {
        const modal = document.getElementById('modal')
        if (event.target === modal) this.hideModal()
      },
      { signal }
    )
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && this.modal?.classList.contains('modal-open')) {
          this.hideModal()
        }
      },
      { signal }
    )
    document.addEventListener('astro:before-swap', () => this.listenerController?.abort(), {
      once: true,
      signal
    })
  }

  init(config: Partial<Config>) {
    this.config = {
      private_api_url: config.private_api_url || '',
      page_turning_number: config.page_turning_number || 20,
      error_img:
        config.error_img ||
        'https://fastly.jsdelivr.net/gh/willow-god/Friend-Circle-Lite@latest/static/favicon.ico'
    }

    this.root = document.getElementById('friend-circle-lite-root') as HTMLElement
    if (!this.root) return

    this.root.innerHTML = ''
    this.createContainers()
  }

  private createContainers() {
    const tip = this.createElement('div', {
      id: 'fc-tip',
      innerHTML:
        '<span class="fc-tip-icon" aria-hidden="true"></span><span>展示朋友们最近发布的文章，点击头像或作者名可查看该站近期内容</span>'
    })
    this.randomArticleContainer = this.createElement('div', { id: 'random-article' })
    this.container = this.createElement('div', {
      className: 'articles-container',
      id: 'articles-container'
    })
    this.controlsContainer = this.createElement('div', {
      id: 'fc-controls',
      className: 'fc-controls'
    })
    this.loadMoreBtn = this.createElement('button', {
      id: 'load-more-btn',
      type: 'button',
      innerHTML: '<span>显示更多</span><span aria-hidden="true">↓</span>'
    }) as HTMLButtonElement
    this.collapseBtn = this.createElement('button', {
      id: 'collapse-btn',
      type: 'button',
      innerHTML: '<span>收起</span><span aria-hidden="true">↑</span>'
    }) as HTMLButtonElement
    this.endMessage = this.createElement('span', {
      id: 'fc-end-message',
      innerText: '已经到底了'
    })
    this.statsContainer = this.createElement('div', { id: 'stats-container' })
    this.controlsContainer.append(this.loadMoreBtn, this.endMessage, this.collapseBtn)

    this.root.append(
      tip,
      this.randomArticleContainer,
      this.container,
      this.controlsContainer,
      this.statsContainer
    )
  }

  private createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Partial<HTMLElementTagNameMap[K]>
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag)
    Object.assign(element, attributes)
    return element
  }

  async loadArticles() {
    const cacheKey = 'friend-circle-lite-cache'
    const cacheTimeKey = 'friend-circle-lite-cache-time'
    const cacheTime = localStorage.getItem(cacheTimeKey)
    const cachedDataString = localStorage.getItem(cacheKey)
    const now = Date.now()

    if (cacheTime && now - Number(cacheTime) < 10 * 60 * 1000) {
      try {
        const cachedData = cachedDataString ? JSON.parse(cachedDataString) : null
        if (cachedData) {
          this.processArticles(cachedData)
          return
        }
      } catch {
        localStorage.removeItem(cacheKey)
        localStorage.removeItem(cacheTimeKey)
      }
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(`${this.config.private_api_url}all.json`, {
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as ArticleData
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(cacheTimeKey, now.toString())
      this.processArticles(data)
    } catch (error) {
      try {
        const staleData = cachedDataString ? (JSON.parse(cachedDataString) as ArticleData) : null
        if (staleData) {
          this.processArticles(staleData)
          this.statsContainer.insertAdjacentHTML(
            'afterbegin',
            '<div class="fc-cache-notice">接口暂不可用，当前显示上次缓存。</div>'
          )
          return
        }
      } catch {
        localStorage.removeItem(cacheKey)
        localStorage.removeItem(cacheTimeKey)
      }

      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? '请求超时'
          : error instanceof Error
            ? error.message
            : '请稍后重试'
      this.container.innerHTML = `
        <div class="fc-empty">
          <strong>邻站动态加载失败</strong>
          <span>${this.escapeHtml(message)}</span>
          <button type="button" data-fc-retry>重新加载</button>
        </div>
      `
      this.container.querySelector('[data-fc-retry]')?.addEventListener('click', () => {
        this.container.innerHTML = '<div class="fc-empty"><span>正在重新加载...</span></div>'
        void this.loadArticles()
      })
      this.controlsContainer.hidden = true
    } finally {
      window.clearTimeout(timeout)
    }
  }

  processArticles({ article_data, statistical_data }: ArticleData) {
    this.allArticles = article_data
    this.visibleCount = Math.min(this.config.page_turning_number, this.allArticles.length)
    this.updateStats(statistical_data)
    this.displayRandomArticle()
    this.renderArticles()
  }

  private updateStats(stats: ArticleData['statistical_data']) {
    this.statsContainer.innerHTML = `
      <div>${stats.friends_num} 个友链 · ${stats.active_num} 个活跃 · ${stats.article_num} 篇文章</div>
      <div>更新于 ${stats.last_updated_time}</div>
      <div>Powered by <a href="https://github.com/willow-god/Friend-Circle-Lite" target="_blank" rel="noopener noreferrer">FriendCircleLite</a></div>
    `
  }

  private renderArticles(startIndex = 0, isCollapse = false) {
    if (isCollapse || startIndex === 0) {
      this.container.innerHTML = ''
    }
    const articles = this.allArticles.slice(startIndex, this.visibleCount)
    articles.forEach((article, index) => this.createArticleCard(article, index * 0.05))

    if (this.allArticles.length === 0) {
      this.container.innerHTML = `
        <div class="fc-empty">
          <strong>暂时没有邻站动态</strong>
          <span>稍后再来看看吧</span>
        </div>
      `
    }

    const hasMore = this.visibleCount < this.allArticles.length
    const canCollapse = this.visibleCount > this.config.page_turning_number
    this.loadMoreBtn.hidden = !hasMore
    this.endMessage.hidden = hasMore || this.allArticles.length === 0
    this.collapseBtn.hidden = !canCollapse
    this.controlsContainer.hidden = this.allArticles.length === 0
  }

  private createArticleCard(article: Article, delay = 0) {
    const card = document.createElement('div')
    card.className = 'article'
    if (delay > 0) {
      card.style.animationDelay = `${delay}s`
    }
    card.innerHTML = `
      <img class="article-background no-lightbox" src="${article.avatar || this.config.error_img}" alt="" aria-hidden="true" onerror="this.style.display='none'">
      <div class="article-content">
        <div class="article-image author-click" title="点击查看作者文章">
          <img class="no-lightbox" src="${article.avatar || this.config.error_img}" alt="${article.author}" onerror="this.src='${this.config.error_img}'">
        </div>
        <div class="article-container">
          <div class="article-meta">
            <button class="article-author author-click" type="button" title="点击查看作者文章">${article.author}</button>
            <time class="article-date">${article.created.substring(0, 10)}</time>
          </div>
          <a class="article-title" href="${article.link instanceof URL ? article.link.toString() : article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>
        </div>
      </div>
    `
    card.querySelectorAll('.author-click').forEach((el) => {
      el.addEventListener('click', () => {
        this.showAuthorArticles(article.author, article.avatar, article.link)
      })
    })
    this.container.appendChild(card)
  }

  displayRandomArticle() {
    const randomArticle = this.allArticles[Math.floor(Math.random() * this.allArticles.length)]
    if (!randomArticle) return
    this.randomArticleContainer.innerHTML = `
      <img class="random-background no-lightbox" src="${randomArticle.avatar || this.config.error_img}" alt="" aria-hidden="true" onerror="this.style.display='none'">
      <div class="random-content">
        <div class="random-title">随机漫游</div>
        <div class="article-image author-click" title="点击查看作者文章">
          <img class="no-lightbox" src="${randomArticle.avatar || this.config.error_img}" alt="${randomArticle.author}" onerror="this.src='${this.config.error_img}'">
        </div>
        <div class="article-container">
          <div class="article-author author-click" title="点击查看作者文章">${randomArticle.author}</div>
          <a class="article-title" href="${randomArticle.link}" target="_blank" rel="noopener noreferrer">${randomArticle.title}</a>
          <div class="article-date">${randomArticle.created.substring(0, 10)}</div>
        </div>
        <button id="random-refresh" type="button" aria-label="换一篇随机文章" title="换一篇">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g fill="none"><path d="M24 0v24H0V0zM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M2 12.08c-.006-.862.91-1.356 1.618-.975l.095.058l2.678 1.804c.972.655.377 2.143-.734 2.007l-.117-.02l-1.063-.234a8.002 8.002 0 0 0 14.804.605a1 1 0 0 1 1.82.828c-1.987 4.37-6.896 6.793-11.687 5.509A10 10 0 0 1 2 12.08m.903-4.228C4.89 3.482 9.799 1.06 14.59 2.343a10 10 0 0 1 7.414 9.581c.007.863-.91 1.358-1.617.976l-.096-.058l-2.678-1.804c-.972-.655-.377-2.143.734-2.007l.117.02l1.063.234A8.002 8.002 0 0 0 4.723 8.68a1 1 0 1 1-1.82-.828"/></g></svg>
        </button>
      </div>
    `
    this.randomArticleContainer.querySelectorAll('.author-click').forEach((el) => {
      el.addEventListener('click', () => {
        this.showAuthorArticles(randomArticle.author, randomArticle.avatar, randomArticle.link)
      })
    })
    this.randomArticleContainer
      .querySelector('button#random-refresh')
      ?.addEventListener('click', (event) => {
        event.preventDefault()
        this.displayRandomArticle()
      })
  }

  // Enable modal
  showAuthorArticles(author: string, avatar: string, link: string | URL) {
    const authorName = this.escapeHtml(author)
    const authorAvatar = this.escapeHtml(avatar || this.config.error_img)
    const siteUrl = new URL(link.toString()).origin

    if (!document.getElementById('modal')) {
      const modal = this.createElement('div', { id: 'modal', className: 'modal' })
      modal.innerHTML = `
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-author-name">
          <div class="modal-header">
            <div class="modal-author">
              <img class="modal-author-avatar no-lightbox" src="${authorAvatar}" alt="${authorName}">
              <div class="modal-author-info">
                <div class="modal-eyebrow">近期文章</div>
                <a id="modal-author-name" class="modal-author-name-link" href="${siteUrl}" target="_blank" rel="noopener noreferrer">${authorName}</a>
              </div>
            </div>
            <button class="modal-close" type="button" aria-label="关闭">×</button>
          </div>
          <div id="modal-articles-container"></div>
          <div class="modal-footer">
            <a class="modal-site-link" href="${siteUrl}" target="_blank" rel="noopener noreferrer">
              访问站点
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      `
      modal.querySelector<HTMLButtonElement>('.modal-close')?.addEventListener('click', () => {
        this.hideModal()
      })
      document.body.appendChild(modal)
    }
    this.modal = document.getElementById('modal') as HTMLElement
    const modalArticlesContainer = document.getElementById(
      'modal-articles-container'
    ) as HTMLElement
    modalArticlesContainer.innerHTML = '' // Clear previous articles
    const authorArticles = this.allArticles.filter((article) => article.author === author)
    authorArticles.slice(0, 4).forEach((article) => {
      const title = this.escapeHtml(article.title)
      const articleUrl = this.escapeHtml(
        article.link instanceof URL ? article.link.toString() : article.link
      )
      const articleTemplate = `
        <a class="modal-article" href="${articleUrl}" target="_blank" rel="noopener noreferrer">
          <div class="modal-article-main">
            <div class="modal-article-title">${title}</div>
            <time class="modal-article-date">${article.created.substring(0, 10)}</time>
          </div>
          <span class="modal-article-arrow" aria-hidden="true">↗</span>
        </a>`
      modalArticlesContainer.insertAdjacentHTML('beforeend', articleTemplate)
    })

    this.modal.style.display = 'flex'
    document.body.style.overflow = 'hidden'
    setTimeout(() => {
      this.modal.classList.add('modal-open')
      this.modal.querySelector<HTMLButtonElement>('.modal-close')?.focus()
    }, 10)
  }

  hideModal() {
    if (!this.modal || !this.modal.classList.contains('modal-open')) return
    this.modal.classList.remove('modal-open')
    document.body.style.overflow = ''
    window.setTimeout(() => {
      this.modal.style.display = 'none'
      if (this.modal.parentNode === document.body) {
        document.body.removeChild(this.modal)
      }
    }, 220)
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        })[character] || character
    )
  }
}
