import { promises as fs } from 'node:fs'
import path from 'node:path'

const dataFilePath = path.resolve('server/data/entries.json')

export async function readEntries() {
  try {
    const rawValue = await fs.readFile(dataFilePath, 'utf8')
    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

export async function writeEntries(entries) {
  await fs.writeFile(dataFilePath, JSON.stringify(entries, null, 2))
}
