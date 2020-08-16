# Red Block

- Firefox: https://addons.mozilla.org/en-US/firefox/addon/red-block/
- Chrome/Chromium: https://chrome.google.com/webstore/detail/red-block/knjpopecjigkkaddmoahjcfpbgedkibf
- Edge: https://microsoftedge.microsoft.com/addons/detail/red-block/pfafjkemefoedhcdlhbniejjealpglbj

Red Block(레드블락)은 트위터에서 특정 사용자의 팔로워를 일괄적으로 차단하는 [Twitter Block Chain](https://github.com/satsukitv/twitter-block-chain) (aka. 체인블락)이나 [BlockThemAll](https://github.com/u1-liquid/BlockThemAll)을 대체할 수 있는 웹 브라우저 확장기능입니다.

Red Block is an extension for blocking users from Twitter. It is intended to replace [Twitter Block Chain](https://github.com/satsukitv/twitter-block-chain) or [BlockThemAll](https://github.com/u1-liquid/BlockThemAll).

## 주의!!

(2020-08-16)

트위터에서 (레드블락이 내부적으로 사용했던) `block_all` API를 종료하게 되었습니다. 이 때문에 레드블락은 공식 차단API를 사용하게 되어 강제 로그아웃이나 계정정지 등의 문제가 발생할 가능성이 있습니다. 이러한 문제를 줄이고자 **레드블락은 500명 미만의 유저만 차단하는 제한을 두게 습니다.**

Twitter discontinued `block_all` API that used by Red Block internally. So Red Block has to use its official block API that has known problems like force-logout and account suspension. To avoid this problem as possible, **Red Block will limit blocking over 500 users.**

## 기능

- 멀티 세션: 체인블락 사용 도중 트위터를 사용하거나 다른 사용자에게 체인블락을 실행할 수 있습니다. - **주의**: 단, 체인블락 사용 중 로그아웃을 하거나 계정전환을 하면 오작동이 일어납니다.
- API 리밋대응: 리밋에 도달했을 때 오류를 내며 정지하지 않고 대기한 뒤 리밋이 풀릴 때 다시 실행할 수 있습니다.
- 맞팔로우 체인블락기능: 상대방과 맞팔로우한 사용자만 골라서 차단합니다.
- 언체인블락 (팔로워 전체를 차단**해제**하기)
- 사용자 저장기능: 특정 사용자에게 자주 (언)체인블락을 실행한다면, 그 사용자의 프로필을 직접 들어가지 않아도 실행할 수 있는 기능입니다.
- 트윗반응 기반 체인블락: 특정 트윗을 리트윗하거나 마음에 들어한 사용자를 일괄적으로 차단합니다.
- 상대방이 나를 차단해도 (조건부로) 체인블락을 실행 할 수 있습니다.

## 비교

| 기능                  | Red Block | Twitter Block Chain | BlockThemAll |
| --------------------- | --------- | ------------------- | ------------ |
| 팔로워 체인블락       | O         | O                   | O            |
| 팔로잉 체인블락       | O         | O                   | O            |
| 맞팔로우 체인블락     | O         | X                   | X            |
| 내 팔로잉/팔로워 필터 | O         | \* [^1]             | \* [^2]      |
| API 리밋대응          | O         | X                   | O            |
| 사용자 저장           | O         | X                   | X            |
| 언체인블락            | O         | X                   | X            |
| 트윗반응 체인블락     | O         | X                   | X            |

[^1]: 내 팔로잉만 필터링 (옵션 X)
[^2]: 내 팔로워만 필터링 가능(옵션 O)
