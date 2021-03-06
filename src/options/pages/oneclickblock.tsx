import * as Storage from '../../scripts/background/storage.js'

const M = MaterialUI

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
  removeWordById(wordId: string): void
  editWordById(wordId: string): void
  modifyAbilityOfWordById(wordId: string, enabled: boolean): void
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
        {badWord.regexp ? (
          <M.Chip size="small" label={i18n.getMessage('regexp')} />
        ) : (
          <M.Chip size="small" label={i18n.getMessage('th_word')} />
        )}
      </TableCell>
      <TableCell>
        <M.Button variant="outlined" onClick={_event => editWordById(badWord.id)}>
          {i18n.getMessage('edit')}
        </M.Button>
        <M.Button variant="outlined" onClick={_event => removeWordById(badWord.id)}>
          {i18n.getMessage('remove')}
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
    return Storage.onStorageChanged('badWords', setBadWords)
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
  const {
    Table,
    TableHead,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    TableFooter,
  } = MaterialUI
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

export default function OneClickBlockOptions() {
  return (
    <M.Paper>
      <M.Box padding="10px" margin="10px">
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">원클릭차단 / One-click block</M.FormLabel>
          <M.Divider />
          <BadwordsTable />
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
