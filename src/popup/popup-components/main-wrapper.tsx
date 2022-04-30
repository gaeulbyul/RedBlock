import * as MaterialUI from '@mui/material'
import React from 'react'

export default function MainWrapper(
  { isLoading, children }: { isLoading: boolean, children: React.ReactNode },
) {
  if (isLoading) {
    return (
      <main
        className="main"
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialUI.CircularProgress size={60} color="secondary" />
      </main>
    )
  } else {
    return (
      <main className="main">
        {children}
      </main>
    )
  }
}
