interface ICalEvent {
  uid: string
  dtstart: string
  dtend: string
  summary: string | null
}

function parseICalDate(value: string): string {
  // Strip time component (e.g. 20260601T100000Z → 20260601)
  const dateOnly = value.replace(/T\d{6}Z?$/u, '').trim()
  if (dateOnly.length >= 8) {
    return `${dateOnly.slice(0, 4)}-${dateOnly.slice(4, 6)}-${dateOnly.slice(6, 8)}`
  }
  return dateOnly
}

export function parseICalFeed(icalText: string): ICalEvent[] {
  const lines = icalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const events: ICalEvent[] = []
  let current: Partial<ICalEvent> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT') {
      if (current?.uid && current?.dtstart && current?.dtend) {
        events.push(current as ICalEvent)
      }
      current = null
    } else if (current !== null) {
      if (line.startsWith('UID:')) {
        current.uid = line.slice(4)
      } else if (line.startsWith('DTSTART')) {
        current.dtstart = parseICalDate(line.split(':').slice(1).join(':'))
      } else if (line.startsWith('DTEND')) {
        current.dtend = parseICalDate(line.split(':').slice(1).join(':'))
      } else if (line.startsWith('SUMMARY:')) {
        current.summary = line.slice(8)
      }
    }
  }

  return events
}

export async function fetchAndParseICal(url: string): Promise<ICalEvent[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`iCal fetch failed: ${response.status}`)
  const text = await response.text()
  return parseICalFeed(text)
}

export async function performICalSync(
  connection: { ical_url: string | null },
): Promise<{ synced: number; blocked: string[]; error: string | null }> {
  if (!connection.ical_url) {
    return { synced: 0, blocked: [], error: 'No iCal URL provided' }
  }

  if (process.env.EXPO_PUBLIC_USE_MOCK === 'true') {
    const mockBlocked = [
      '2026-06-01', '2026-06-02', '2026-06-03',
      '2026-06-15', '2026-06-16',
    ]
    return { synced: mockBlocked.length, blocked: mockBlocked, error: null }
  }

  try {
    const events = await fetchAndParseICal(connection.ical_url)
    const blocked: string[] = []

    for (const event of events) {
      const start = new Date(event.dtstart)
      const end = new Date(event.dtend)
      const current = new Date(start)

      while (current < end) {
        blocked.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
    }

    return { synced: events.length, blocked, error: null }
  } catch (err) {
    return {
      synced: 0,
      blocked: [],
      error: err instanceof Error ? err.message : 'Sync failed',
    }
  }
}
