import * as MaterialUI from '@mui/material'
import React from 'react'

const M = MaterialUI
const T = MaterialUI.Typography

export default function Accordion({
  summary,
  children,
  defaultExpanded,
  warning,
}: {
  summary: string
  children: React.ReactNode
  defaultExpanded?: boolean
  warning?: boolean
}) {
  return (
    <M.Accordion defaultExpanded={defaultExpanded}>
      <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T sx={{ color: warning ? 'warning.main' : 'text.primary' }}>{summary}</T>
      </M.AccordionSummary>
      <M.AccordionDetails>{children}</M.AccordionDetails>
    </M.Accordion>
  )
}
