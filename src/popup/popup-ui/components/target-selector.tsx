import * as MaterialUI from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'

import React from 'react'
import * as i18n from '../../../scripts/i18n'

const M = MaterialUI

type TargetType = 'user' | 'tweet'
export type TargetGroup = 'current' | 'bookmarked' | 'other tab'

export interface TargetSelectorItem {
  type: TargetType
  idStr: string
  bookmarkId?: string
  group: TargetGroup
}

interface TargetSelectorContextType {
  selectedItemIdentifier: string
  onChange(event: SelectChangeEvent): void
}

const TargetSelectorContext = React.createContext<TargetSelectorContextType>(null!)

export function identifierOfItem(item: TargetSelectorItem): string {
  return `${item.group}/${item.type}/${item.idStr}`
}

export function UserItem({
  group,
  user,
  bookmarkId,
}: {
  group?: TargetGroup
  user: TwitterUser
  bookmarkId?: string
}) {
  if (!group) {
    throw new Error('group is missing.')
  }
  const { id_str: userId } = user
  const label = `@${user.screen_name} <${user.name}>`
  const identifier = identifierOfItem({
    type: 'user',
    group,
    idStr: userId,
  })
  return (
    <option
      value={identifier}
      data-type="user"
      data-group={group}
      data-idstr={userId}
      data-bookmark-id={bookmarkId}
    >
      {label}
    </option>
  )
}

export function TweetItem({
  group,
  tweet,
  bookmarkId,
}: {
  group?: TargetGroup
  tweet: Tweet
  bookmarkId?: string
}) {
  if (!group) {
    throw new Error('group is missing.')
  }
  const { id_str: tweetId, user } = tweet
  const label = `@${user.screen_name}: <${tweet.full_text}>` // TODO: display-text-range 적용
  const identifier = identifierOfItem({
    type: 'tweet',
    group,
    idStr: tweetId,
  })
  return (
    <option
      value={identifier}
      data-type="tweet"
      data-group={group}
      data-idstr={tweetId}
      data-bookmark-id={bookmarkId}
    >
      {label}
    </option>
  )
}

export function ItemsGroup({
  label,
  group,
  children,
}: {
  label: string
  group: TargetGroup
  children: React.ReactNode
}) {
  return (
    <optgroup label={label}>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) {
          throw new Error('invalid child??')
        }
        return React.cloneElement(child, {
          group,
        })
      })}
    </optgroup>
  )
}

export function Options({ label, children }: { label: string, children: React.ReactNode }) {
  const { selectedItemIdentifier, onChange } = React.useContext(TargetSelectorContext)
  // TODO: i18n:user_not_selected -> 유저뿐만 아니라 트윗도 선택할 수 있음을 감안하여 수정할 것
  return (
    <M.FormControl fullWidth variant="standard">
      <M.InputLabel shrink htmlFor="target-select">
        {label}
      </M.InputLabel>
      <M.Select
        native
        id="target-select"
        fullWidth
        label={label}
        value={selectedItemIdentifier}
        onChange={onChange}
      >
        <option hidden disabled value="">
          {i18n.getMessage('user_not_selected')}
        </option>
        {children}
      </M.Select>
    </M.FormControl>
  )
}

export function Controls({ children }: { children: React.ReactNode }) {
  return (
    <M.Box my={1} display="flex" flexDirection="row-reverse">
      <M.ButtonGroup>{children}</M.ButtonGroup>
    </M.Box>
  )
}

export function TargetSelector({
  selectedItemIdentifier,
  onSelectTarget,
  children,
}: {
  type: TargetType // TODO: 필요없음 지우자.
  selectedItemIdentifier: string
  onSelectTarget(item: TargetSelectorItem): void
  children: React.ReactNode
}) {
  function onChange({ target }: SelectChangeEvent) {
    if (!(target instanceof HTMLSelectElement)) {
      throw new Error('unreachable')
    }
    const selectedOption = target.selectedOptions[0]!
    const targetType = selectedOption.getAttribute('data-type') as TargetType
    const targetGroup = selectedOption.getAttribute('data-group') as TargetGroup
    const idStr = selectedOption.getAttribute('data-idstr')!
    const selectedItem: TargetSelectorItem = {
      type: targetType,
      group: targetGroup,
      idStr,
    }
    onSelectTarget(selectedItem)
  }
  return (
    <div style={{ width: '100%' }}>
      <TargetSelectorContext.Provider value={{ selectedItemIdentifier, onChange }}>
        {children}
      </TargetSelectorContext.Provider>
    </div>
  )
}
