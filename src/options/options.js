/* globals
  browser,
  angular,
  ExtOption,
*/

const DEFAULT_OPTIONS = ExtOption.defaults

const app = angular.module('RedBlockOptionsApp', [])

// 한글입력에 ng-change 반응하도록
// see: http://118k.tistory.com/135
// see: https://qiita.com/koh110/items/4c5d22339ef2117e226a
app.directive('kInput', () => ({
  priority: 2,
  restrict: 'A',
  compile (element) {
    element.on('compositionstart', e => {
      e.stopImmediatePropagation()
    })
  }
}))

app.service('Storage', ['$q', function ($q) {
  // Native Promise를 AngularJS의 $q Promise로 바꿔서 반환해주도록 하는
  // ...삽질
  const handler = {
    get (target, key, receiver) {
      // 1. 기존 메서드를 구한다.
      const originalMethod = Reflect.get(target, key, receiver)
      if (typeof originalMethod !== 'function') {
        return originalMethod
      }
      // 2. 해당 메서드가 반환한 값을 $q.when으로 감싸주는 Proxy를 적용한다.
      return new Proxy(originalMethod, {
        apply (target, thisArg, argumentsList) {
          const returned = Reflect.apply(target, thisArg, argumentsList)
          if (returned instanceof Promise) {
            return $q.when(returned)
          } else {
            return returned
          }
        }
      })
    }
  }
  this.local = new Proxy(browser.storage.local, handler)
  this.sync = new Proxy(browser.storage.sync, handler)
}])

app.service('Achtung', ['$rootScope', function ($rootScope) {
  this.changeAgreement = agree => {
    $rootScope.$broadcast('changeAgreement', agree)
  }
}])
app.controller('achtungController', ['$scope', 'Storage', 'Achtung', ($scope, Storage, Achtung) => {
  $scope.agreement = ''
  $scope.onChange = () => {
    const agree = ($scope.agreement || '').trim() === '동의합니다'
    Storage.local.set({ agree })
    Achtung.changeAgreement(agree)
  }
  Storage.local.get('agree').then(({ agree }) => {
    $scope.agreement = agree ? '동의합니다' : ''
    Achtung.changeAgreement(agree)
  })
}])

app.controller('optionsController', ['$scope', 'Storage', ($scope, Storage) => {
  $scope.options = {}
  $scope.isDisabled = true
  $scope.$on('changeAgreement', (event, agree) => {
    $scope.isDisabled = !agree
  })
  $scope.onChange = () => {
    const options = Object.entries($scope.options).reduce((obj, [key, value]) => {
      obj[key] = value != null ? value : DEFAULT_OPTIONS[key]
      return obj
    }, {})
    console.log(options)
    Storage.local.set({ options })
  }
  Storage.local.get('options').then(({ options: userOptions }) => {
    console.info('initing...')
    const options = Object.assign({}, DEFAULT_OPTIONS, userOptions)
    $scope.agreement = options.agree ? '동의합니다' : ''
    Object.assign($scope.options, options)
  })
}])

app.component('f2bUserList', {
  templateUrl: 'templates/f2b-user-list.html',
  // controller: 'targetUsersController',
  controller: ['$scope', function ($scope) {
    $scope.removeUser = user => {
      if (!window.confirm(`사용자 @${user.username}을(를) 목록에서 삭제하시겠습니까?`)) {
        return
      }
      $scope.$emit('removeUser', { userId: user.id })
    }
  }],
  bindings: {
    users: '<'
  }
})

app.controller('f2bController', ['$scope', 'Storage', ($scope, Storage) => {
  $scope.targetUsers = []
  $scope.isDisabled = true
  $scope.$on('removeUser', (event, { userId }) => {
    const targetUsers = $scope.targetUsers.filter(user => {
      return user.id !== userId
    })
    $scope.targetUsers = targetUsers
    Storage.local.set({ targetUsers })
  })
  $scope.$on('changeAgreement', (event, agree) => {
    $scope.isDisabled = !agree
  })
  Storage.local.get('f2bUsers').then(({ targetUsers }) => {
    $scope.targetUsers = targetUsers
  })
}])












/*
function makeUserItem (user) {
  const template = document.getElementById('T_user')
  const item = document.importNode(template.content, true)
  const nameElem = item.querySelector('.name')
  nameElem.textContent = `ID: ${user.id}`
  nameElem.title = `@${user.username}`
  nameElem.href = `https://twitter.com/intent/user?user_id=${user.id}`
  nameElem.rel = 'noreferrer'
  nameElem.target = '_blank'
  item.querySelector('button.remove').addEventListener('click', event => {
    console.info('click remove!')
  })
  return item
}

function checkAgreement () {
  const confirmation = document.getElementById('agreement-confirmation')
  const confirmed = confirmation.value.trim() === '동의합니다'
  browser.storage.local.get('options').then(({ options }) => {
    Object.assign(options, {
      agree: confirmed
    })
    browser.storage.local.set({ options })
  })
  document.querySelectorAll('fieldset.require-agreement').forEach(f => {
    f.disabled = !confirmed
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  const {
    targetUsers,
    options
  } = await browser.storage.local.get(['targetUsers', 'options'])
  /-
  const userList = document.getElementById('target-user-list')
  for (const user of targetUsers) {
    const item = makeUserItem(user)
    userList.appendChild(item)
  }
  const confirmation = document.getElementById('agreement-confirmation')
  confirmation.addEventListener('input', event => {
    checkAgreement();
  });
  if (options.agree === true) {
    confirmation.value = '동의합니다'
  }
  checkAgreement();
  -/
})
*/

