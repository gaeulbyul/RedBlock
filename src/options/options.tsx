import * as Storage from '../scripts/background/storage.js'
import * as i18n from '../scripts/i18n.js'

const optionsMuiTheme = MaterialUI.createMuiTheme({
  palette: {
    primary: MaterialUI.colors.pink,
    secondary: MaterialUI.colors.indigo,
  },
})

const M = MaterialUI
const T = MaterialUI.Typography

type RedBlockOptions = Storage.RedBlockStorage['options']

const useStylesForTable = MaterialUI.makeStyles(_theme => ({
  fullWidth: {
    width: '100%',
  },
}))

function BadwordsTable() {
  // L10N-ME
  const { Table, TableHead, TableBody, TableCell, TableContainer, TableRow, TableFooter } = MaterialUI
  const classes = useStylesForTable()
  return (
    <M.Paper className={classes.fullWidth}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <M.Checkbox>
                </M.Checkbox>
              </TableCell>
              <TableCell>
                <strong>단어</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell padding="checkbox">
                <M.Checkbox>
                </M.Checkbox>
              </TableCell>
              <TableCell>
                asdf
              </TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>
                <M.Input placeholder="[여기에 대충 단어 입력]" />
                <M.Button>
                  추가하기
                </M.Button>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </M.Paper>
  )
}

function OptionsApp() {
  const [options, setOptions] = React.useState<RedBlockOptions>(Storage.defaultOptions)
  React.useEffect(() => {
    Storage.loadOptions().then(setOptions)
    return Storage.onOptionsChanged(setOptions)
  }, [])
  async function mutateOptions(newOptionsPart: Partial<RedBlockOptions>) {
    const newOptions = { ...options, ...newOptionsPart }
    await Storage.saveOptions(newOptions)
    setOptions(newOptions)
  }
  return (
    <M.ThemeProvider theme={optionsMuiTheme}>
      <M.AppBar position="static">
        <M.Toolbar variant="dense">
          <T variant="h6">
            옵션 / Options
          </T>
        </M.Toolbar>
      </M.AppBar>
      <M.Container maxWidth="md">
        <M.Box padding="10px">
          <M.FormControl component="fieldset" fullWidth>
            <M.FormLabel component="legend">체인블락 / Chainblock</M.FormLabel>
            <M.FormGroup>
              <M.FormControlLabel
                control={<M.Checkbox size="small" />}
                onChange={() =>
                  mutateOptions({
                    useStandardBlockAPI: !options.useStandardBlockAPI,
                  })
                }
                checked={options.useStandardBlockAPI}
                label={i18n.getMessage('use_official_block_api')}
              />
              <M.FormHelperText>{i18n.getMessage('use_official_block_api_warning')}</M.FormHelperText>
              <M.FormControlLabel
                control={<M.Checkbox size="small" />}
                onChange={() =>
                  mutateOptions({
                    removeSessionAfterComplete: !options.removeSessionAfterComplete,
                  })
                }
                checked={options.removeSessionAfterComplete}
                label={i18n.getMessage('remove_session_after_complete')}
              />
            </M.FormGroup>
          </M.FormControl>
          <M.Divider />
          <M.FormControl component="fieldset" fullWidth>
            <M.FormLabel component="legend">원클릭차단 / One-click block</M.FormLabel>
            <BadwordsTable />
          </M.FormControl>
        </M.Box>
      </M.Container>
    </M.ThemeProvider>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
