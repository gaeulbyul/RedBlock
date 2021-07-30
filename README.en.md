[한국어 README](./README.md)

---

# Red Block

- Firefox: https://addons.mozilla.org/en-US/firefox/addon/red-block/
- Chrome/Chromium: https://chrome.google.com/webstore/detail/red-block/knjpopecjigkkaddmoahjcfpbgedkibf
- MS Edge: https://microsoftedge.microsoft.com/addons/detail/red-block/pfafjkemefoedhcdlhbniejjealpglbj
- Whale: https://store.whale.naver.com/detail/laokmejddmpcelebbplgenhdgafelmgn

Red Block is an extension for block, unblock, mute, or unmute multiple users from [Twitter](https://twitter.com) or [TweetDeck](https://tweetdeck.twitter.com). It can use as an alternative to [Twitter Block Chain](https://github.com/ceceradio/twitter-block-chain).

## Feature

- Not only does Chainblock, but it can also Unchainblock, Chainmute, and Unchainmute.
- It can run multiple Chainblock sessions.
- It won't block your mutual followers.
- You can adjust options to skip, mute, or block your followers in session.
- It can run a session to block the mutual followers of the target user.
- It can run a session to block users who retweeted and/or liked a specific tweet.
- You can save users to the bookmark. (also saving tweet is planned)
- It doesn't access any external service other than Twitter.

## Limitation

Currently, Red Block has the following technical limitations:

### About 500 users limitations of Chainblock

Red Block will warn before it exceeds 500 users (per day? Note that this limitation is not documented anywhere). This limitation is to avoid force-logout and account suspension. Clicking the "Reset" button will clear this counter manually but it is not recommended. (especially your account's recovery email/phone is not available.)

### Tweet reaction Chainblock doesn't block the entire retweeted/liked user.

This is because Twitter doesn't always provide _entire_ list of users who retweeted/liked a specific tweet. It is a limitation of Twitter API.

### `webRequest` API (only on Chrome/Chromium based browsers)

Currently, Red Block uses the "webRequest" API for several features.

- Supporting Firefox's container tab feature.
- Supporting Incognito (Private) mode.
- Detect and prevent blocking more than 500 users. (block limiter)
- Run Chainblock to the user even they blocking you (Experimental feature)

But, Chrome will restrict this `webRequest` API in the future. (see: https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/#modifying-network-requests ) so Red Block may change or remove these features. Note that it doesn't affect Firefox and other web browsers that based on Firefox(such as Ghostery Dawn, Librewolf Browser).

## Build

1. Install dependencies with `yarn` (or `npm install`).
1. Running `yarn build` (or `npm run build`) will build an extension to "build/".

## Alternatives

There are several alternatives that help block multiple users.

- Twitter-Block-With-Love - https://github.com/E011011101001/Twitter-Block-With-Love
- Secataur - https://secateur.app/
- Likers Blocker - https://dmstern.github.io/likers-blocker/
- Blockasaurus - https://blockasaurus.glitch.me/
- Poop blocker - https://poop-blocker.glitch.me/
- Block Party - https://www.blockpartyapp.com/
