import { validateUserName } from './utilities'

export default class TwitterURL extends URL {
  public constructor(url: string | URL | Location | HTMLAnchorElement) {
    super(url.toString())
    this.validateURL(this)
  }

  public static nullable(url: string | URL | Location | HTMLAnchorElement): TwitterURL | null {
    try {
      const twURL = new TwitterURL(url)
      return twURL
    } catch {
      return null
    }
  }

  public getUserName(): string | null {
    const { pathname } = this
    const nonUserPagePattern = /^\/[a-z]{2}\/(?:tos|privacy)/
    if (nonUserPagePattern.test(pathname)) {
      return null
    }
    const pattern = /^\/([0-9A-Za-z_]{1,15})/i
    const match = pattern.exec(pathname)
    if (!match) {
      return null
    }
    const userName = match[1]
    if (userName && validateUserName(userName)) {
      return userName
    }
    return null
  }

  public getTweetId(): string | null {
    const match = /\/status\/(\d+)/.exec(this.pathname)
    return match ? match[1]! : null
  }

  public getAudioSpaceId(): string | null {
    const match = /^\/i\/spaces\/([A-Za-z0-9]+)/.exec(this.pathname)
    return match ? match[1]! : null
  }

  public getHashTag(): string | null {
    const match = /^\/hashtag\/(.+)$/.exec(this.pathname)
    return match && decodeURIComponent(match[1]!)
  }

  private validateURL(url: URL | Location | HTMLAnchorElement) {
    if (url.protocol !== 'https:') {
      throw new Error(`invalid protocol "${this.protocol}"!`)
    }
    const validHostnames = ['twitter.com', 'mobile.twitter.com', 'tweetdeck.twitter.com']
    if (!validHostnames.includes(this.hostname)) {
      throw new Error(`invalid hostname "${this.hostname}"!`)
    }
  }
}
