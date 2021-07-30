[README in English](./README.en.md)

---

# Red Block (레드블락)

- Firefox: https://addons.mozilla.org/ko/firefox/addon/red-block/
- Chrome/Chromium: https://chrome.google.com/webstore/detail/red-block/knjpopecjigkkaddmoahjcfpbgedkibf
- MS Edge: https://microsoftedge.microsoft.com/addons/detail/red-block/pfafjkemefoedhcdlhbniejjealpglbj
- Whale: https://store.whale.naver.com/detail/laokmejddmpcelebbplgenhdgafelmgn

레드블락은 [트위터](https://twitter.com)나 [트윗덱](https://tweetdeck.twitter.com)에서 여러 유저를 차단·차단해제·뮤트·언뮤트를 할 수 있는 확장기능으로 [Twitter Block Chain](https://github.com/ceceradio/twitter-block-chain)의 대체제로 사용할 수 있습니다.

## 기능

- 체인블락 뿐만 아니라 언체인블락, 체인뮤트, 언체인뮤트를 할 수 있습니다.
- 여러 체인블락 세션을 실행할 수 있습니다.
- 내 맞팔로워는 차단하지 않습니다.
- 내 팔로워를 냅두거나, 뮤트하거나, 차단하도록 설정할 수 있습니다.
- 상대방의 맞팔로워를 골라 차단하는 기능이 있습니다.
- 특정 트윗을 리트윗하거나 마음에 들어한 유저를 차단할 수 있습니다.
- 북마크를 통해 체인블락할 유저를 저장할 수 있습니다. (트윗 저장기능도 계획하고 있습니다.)
- 트위터 외 다른 외부 서비스에 접근하지 않습니다.

## 제한

현재 레드블락엔 다음과 같은 제한사항이 있습니다.

### 500명 차단제한

레드블락은 체인블락 도중 차단한 유저가 500명에 도달하면 경고하도록 했습니다. 이는 트위터에서 차단을 지나치게 많이 실행할 경우 발생할 수 있는 강제로그아웃이나 계정정지를 피하기 위하여 만들었습니다. "RESET" 버튼을 눌러 카운터를 수동으로 초기화할 수 있으나 권장하지 않습니다. (특히 계정복구를 위한 휴대전화나 이메일에 접근할 수 없는 경우라면 더욱 주의해주세요.)

### 트윗의 리트윗/마음에 들어요 체인블락이 전체유저를 차단하지 않음.

이는 트위터 API를 통해 리트윗하거나 마음에 들어한 유저의 목록을 요청할 때 전체 유저목록을 제공하지 않아서 발생하는 제한입니다.

### `webRequest` API (크롬 및 크로미움 계 브라우저만 해당)

현재 레드블락은 다음과 같은 기능을 위해 `webRequest` API를 사용합니다.

- 파이어폭스의 컨테이너 탭 기능 지원.
- Incognito (사생활 보호) 모드 지원.
- 500명 차단리미터 기능.
- 상대방에게 차단당해도 체인블락 세션 실행 (실험적 기능)

하지만 크롬에선 이 `webRequest` API를 제한할 예정입니다. (참고: https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/#modifying-network-requests ). 따라서 레드블락에서 위의 기능을 변경하거나 제거할 수도 있습니다. 참고로 이 제한은 파이어폭스 및 파이어폭스 기반의 다른 웹 브라우저(Ghostery Dawn, Librewolf Browser 등)에는 영향받지 않습니다.

## 빌드

1. `yarn` (또는 `npm install`)을 통해 의존성 패키지를 설치합니다.
1. `yarn build` (또는 `npm run build`)을 실행하면 "build/" 디렉토리에 빌드를 합니다.

## 대체재

여러 유저를 차단하는 데 도움을 주는 다른 프로그램도 있습니다.

- 트윗지기 - https://github.com/SasarinoMARi/Tweeper
- Twitter-Block-With-Love - https://github.com/E011011101001/Twitter-Block-With-Love
- Secataur - https://secateur.app/
- Likers Blocker - https://dmstern.github.io/likers-blocker/
- Blockasaurus - https://blockasaurus.glitch.me/
- Poop blocker - https://poop-blocker.glitch.me/
- Block Party - https://www.blockpartyapp.com/
