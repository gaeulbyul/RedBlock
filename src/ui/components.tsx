import React from 'react'
import * as MaterialUI from '@material-ui/core'

const M = MaterialUI

const useStylesForFormControl = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    fieldset: {
      display: 'flex',
    },
  })
)

export function RadioOptionItem({
  legend,
  options,
  selectedValue,
  onChange,
}: {
  legend: React.ReactNode
  options: { [label: string]: string }
  selectedValue: string
  onChange(newValue: string): void
}) {
  const classes = useStylesForFormControl()
  return (
    <M.FormControl component="fieldset" className={classes.fieldset}>
      <M.FormLabel component="legend">{legend}</M.FormLabel>
      <M.RadioGroup row>
        {Object.entries(options).map(([label, value], index) => (
          <M.FormControlLabel
            key={index}
            control={<M.Radio size="small" />}
            checked={selectedValue === value}
            onChange={() => onChange(value)}
            label={label}
          />
        ))}
      </M.RadioGroup>
    </M.FormControl>
  )
}

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
