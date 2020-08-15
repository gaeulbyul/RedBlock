import * as Storage from '../scripts/background/storage.js'
import * as i18n from '../scripts/i18n.js'
import { RedBlockUITheme } from '../popup/popup-ui/ui-common.js'

const M = MaterialUI
const T = MaterialUI.Typography

type RedBlockOptions = Storage.RedBlockStorage['options']

const useStylesForTable = MaterialUI.makeStyles(_theme => ({
  tablePaper: {
    margin: '10px 0',
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
  modifyAbilityOfWordById: (wordId: string, enabled: boolean) => void
}) {
  const { TableCell, TableRow } = MaterialUI
  const classes = useStylesForRow()
  const { badWord, removeWordById, editWordById, modifyAbilityOfWordById } = props
  return (
    <TableRow>
      <TableCell padding="checkbox">
        <M.Checkbox
          checked={badWord.enabled}
          onChange={(_event, checked) => modifyAbilityOfWordById(badWord.id, checked)}
        />
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
  async function modifyAbilityOfWordById(wordId: string, enabled: boolean) {
    const wordToEdit = badWords.filter(bw => bw.id === wordId)[0]
    const modified: BadWordItem = {
      ...wordToEdit,
      enabled,
    }
    return Storage.editBadWord(wordId, modified)
  }
  async function handleKeypressEvent(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    insertWord()
  }
  const classes = useStylesForTable()
  const sortedBadWords = _.sortBy(badWords, 'word')
  const { Table, TableHead, TableBody, TableCell, TableContainer, TableRow, TableFooter } = MaterialUI
  return (
    <M.Paper variant="outlined" className={classes.tablePaper}>
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
                modifyAbilityOfWordById={modifyAbilityOfWordById}
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
                  onKeyPress={handleKeypressEvent}
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
              <TableCell colSpan={4}>
                <p>{i18n.getMessage('sbs_description')} </p>
                <p>{i18n.getMessage('sbs_please_refresh')}</p>
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
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockUITheme(darkMode), [darkMode])
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
    <M.ThemeProvider theme={theme}>
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
