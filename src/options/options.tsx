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

const useStylesForRow = MaterialUI.makeStyles(_theme => ({
  striked: {
    textDecoration: 'strike',
  },
}))

function BadWordRow(props: {
  badWord: BadWordItem
  removeWordById: (wordId: string) => void
  editWordById: (wordId: string) => void
}) {
  const { TableCell, TableRow } = MaterialUI
  const classes = useStylesForRow()
  const { badWord, removeWordById, editWordById } = props
  return (
    <TableRow>
      <TableCell padding="checkbox">
        <M.Checkbox checked={badWord.enabled} />
      </TableCell>
      <TableCell>
        <span className={badWord.enabled ? '' : classes.striked}>{badWord.word}</span>
      </TableCell>
      <TableCell>
        {badWord.regexp ? <M.Chip size="small" label="정규식" /> : <M.Chip size="small" label="단어" />}
      </TableCell>
      <TableCell>
        <M.Button variant="outlined" onClick={_event => editWordById(badWord.id)}>
          수정
        </M.Button>
        <M.Button variant="outlined" onClick={_event => removeWordById(badWord.id)}>
          삭제
        </M.Button>
      </TableCell>
    </TableRow>
  )
}

function BadwordsTable() {
  const [badWords, setBadWords] = React.useState<BadWordItem[]>([])
  const [newBadWordWord, setNewBadWordWord] = React.useState('')
  const [newBadWordIsRegExp, setNewBadWordIsRegExp] = React.useState(false)
  const [newBadWordWordInputRef] = React.useState(() => React.createRef<HTMLInputElement>())
  React.useEffect(() => {
    Storage.loadBadWords().then(setBadWords)
    return Storage.onBadWordsChanged(setBadWords)
  }, [])
  async function insertWord() {
    const newWord = newBadWordWord
    await Storage.insertBadWord(newWord, newBadWordIsRegExp)
    setNewBadWordWord('')
    setNewBadWordIsRegExp(false)
  }
  async function readyToEditWordById(wordId: string) {
    const wordToEdit = badWords.filter(bw => bw.id === wordId)[0]
    await removeWordById(wordId)
    setNewBadWordWord(wordToEdit.word)
    setNewBadWordIsRegExp(wordToEdit.regexp)
    newBadWordWordInputRef.current!.focus()
  }
  async function removeWordById(wordId: string) {
    return Storage.removeBadWord(wordId)
  }
  const classes = useStylesForTable()
  const sortedBadWords = _.sortBy(badWords, 'word')
  const { Table, TableHead, TableBody, TableCell, TableContainer, TableRow, TableFooter } = MaterialUI
  return (
    <M.Paper variant="outlined" className={classes.fullWidth}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>{i18n.getMessage('th_enable')}</strong>
              </TableCell>
              <TableCell>
                <strong>{i18n.getMessage('th_word')}</strong>
              </TableCell>
              <TableCell>
                <strong>{i18n.getMessage('th_options')}</strong>
              </TableCell>
              <TableCell>
                <strong>{i18n.getMessage('th_actions')}</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedBadWords.map(badWord => (
              <BadWordRow
                badWord={badWord}
                key={badWord.id}
                editWordById={readyToEditWordById}
                removeWordById={removeWordById}
              />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>
                <M.Input
                  fullWidth
                  required
                  ref={newBadWordWordInputRef}
                  placeholder={i18n.getMessage('placeholder_word')}
                  value={newBadWordWord}
                  onChange={event => setNewBadWordWord(event.target.value)}
                />
              </TableCell>
              <TableCell>
                <M.FormControlLabel
                  control={<M.Checkbox />}
                  checked={newBadWordIsRegExp}
                  label={i18n.getMessage('regexp')}
                  onChange={(_event, checked) => setNewBadWordIsRegExp(checked)}
                />
              </TableCell>
              <TableCell>
                <M.Button
                  variant="contained"
                  color="primary"
                  disabled={newBadWordWord.length <= 0}
                  onClick={insertWord}
                >
                  {i18n.getMessage('add_word_button')}
                </M.Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4}>{i18n.getMessage('sbs_description')}</TableCell>
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
          <T variant="h6">옵션 / Options</T>
        </M.Toolbar>
      </M.AppBar>
      <M.Container maxWidth="md">
        <M.Paper>
          <M.Box padding="10px" margin="10px">
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
          </M.Box>
        </M.Paper>
        <M.Paper>
          <M.Box padding="10px" margin="10px">
            <M.FormControl component="fieldset" fullWidth>
              <M.FormLabel component="legend">원클릭차단 / One-click block</M.FormLabel>
              <BadwordsTable />
            </M.FormControl>
          </M.Box>
        </M.Paper>
      </M.Container>
    </M.ThemeProvider>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
