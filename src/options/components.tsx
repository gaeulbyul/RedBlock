const M = MaterialUI

export function SwitchItem(props: {
  label: string
  onChange(checked: boolean): void
  checked: boolean
  disabled?: boolean
}) {
  const { checked, disabled, label } = props
  return (
    <M.FormControlLabel
      control={<M.Switch />}
      {...{ checked, disabled, label }}
      onChange={(_event, checked) => props.onChange(checked)}
    />
  )
}

export function CheckboxItem(props: {
  label: string
  onChange(checked: boolean): void
  checked: boolean
  disabled?: boolean
}) {
  const { checked, disabled, label } = props
  return (
    <M.FormControlLabel
      control={<M.Checkbox size="small" />}
      {...{ checked, disabled, label }}
      onChange={(_event, checked) => props.onChange(checked)}
    />
  )
}
