const M = MaterialUI

export function SwitchItem({
  checked,
  disabled,
  label,
  onChange,
}: {
  label: string
  onChange(checked: boolean): void
  checked: boolean
  disabled?: boolean
}) {
  return (
    <M.FormControlLabel
      control={<M.Switch />}
      {...{ checked, disabled, label }}
      onChange={(_event, checked) => onChange(checked)}
    />
  )
}

export function CheckboxItem({
  checked,
  disabled,
  label,
  onChange,
}: {
  label: string
  onChange(checked: boolean): void
  checked: boolean
  disabled?: boolean
}) {
  return (
    <M.FormControlLabel
      control={<M.Checkbox size="small" />}
      {...{ checked, disabled, label }}
      onChange={(_event, checked) => onChange(checked)}
    />
  )
}
