import { Autocomplete, CircularProgress, FormControl, FormHelperText, FormLabel, SvgIcon, TextField } from '@mui/material'
import { useEffect, useId, useState } from 'react'
import { geocode } from '../../lib/api'
import { colors } from '../../theme'
import type { Place } from '../../types'

interface Props {
  label: string
  value: Place | null
  onChange: (p: Place | null) => void
}

const MIN_CHARS = 3

/**
 * MUI Autocomplete (a proper combobox, keyboard and screen-reader ready) over debounced, cancellable place search.
 * The server proxies Geoapify Address Autocomplete, so no provider key ever reaches the browser.
 */
export function PlaceInput({ label, value, onChange }: Props) {
  const id = useId()
  const [text, setText] = useState(value?.label ?? '')
  const [options, setOptions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // The text is the chosen place's own label (just picked, or the field remounted after the
    // form collapsed): nothing to search for.
    if (value && text === value.label) return
    if (text.trim().length < MIN_CHARS) {
      setOptions([])
      setSearching(false)
      setError('')
      return
    }
    setSearching(true)
    const ctl = new AbortController()
    const timer = setTimeout(() => {
      geocode(text.trim(), ctl.signal)
        .then((r) => {
          setOptions(r)
          setError(r.length ? '' : 'No matches. Try a city name or fuller address.')
          setSearching(false)
        })
        .catch((e) => {
          if (e.name === 'AbortError') return
          setError(e.message)
          setSearching(false)
        })
    }, 450)
    return () => {
      clearTimeout(timer)
      ctl.abort()
    }
  }, [text])

  const showHint = !value && text.trim().length >= MIN_CHARS && !searching && !open && !error

  return (
    <FormControl fullWidth>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <Autocomplete
        id={id}
        size="small"
        options={options}
        value={value}
        inputValue={text}
        open={open && text.trim().length >= MIN_CHARS}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onInputChange={(_, v, reason) => {
          setText(v)
          if (reason === 'input' && value) onChange(null)
        }}
        onChange={(_, v) => onChange(v)}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.lat === b.lat && a.lon === b.lon}
        getOptionKey={(o) => `${o.lat},${o.lon}`}
        filterOptions={(x) => x} // the geocoder already filtered
        autoHighlight // Enter picks the first suggestion
        clearOnBlur={false}
        forcePopupIcon={false}
        loading={searching}
        loadingText="Searching…"
        noOptionsText={error || 'No matches. Try a city name or fuller address.'}
        slotProps={{ clearIndicator: { sx: { display: 'none' }, tabIndex: -1 } }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="City or address"
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {searching ? (
                      <CircularProgress size={14} aria-label="Searching" />
                    ) : value ? (
                      <SvgIcon fontSize="small" aria-label="Location selected" sx={{ color: '#16a34a' }}>
                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </SvgIcon>
                    ) : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {error && !value && !open && <FormHelperText sx={{ color: colors.hint }}>{error}</FormHelperText>}
      {showHint && <FormHelperText sx={{ color: colors.hint }}>Choose a suggestion from the list.</FormHelperText>}
    </FormControl>
  )
}
