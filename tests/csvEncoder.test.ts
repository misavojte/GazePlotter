import { describe, it, expect } from 'vitest'
import {
  formatNumberForCsv,
  escapeCsvField,
  encodeCsvRow,
  generateCsvString,
} from '../src/lib/data/export/encoders/csv'

describe('CSV Encoder', () => {
  describe('formatNumberForCsv', () => {
    it('handles decimal separator correctly', () => {
      expect(formatNumberForCsv(12.34, '.')).toBe('12.34')
      expect(formatNumberForCsv(12.34, ',')).toBe('12,34')
    })

    it('handles non-numeric values gracefully', () => {
      expect(formatNumberForCsv(null)).toBe('')
      expect(formatNumberForCsv(undefined)).toBe('')
      expect(formatNumberForCsv(Infinity)).toBe('')
    })
  })

  describe('escapeCsvField', () => {
    it('escapes fields containing the delimiter', () => {
      expect(escapeCsvField('hello,world', ',')).toBe('"hello,world"')
      expect(escapeCsvField('hello;world', ';')).toBe('"hello;world"')
    })

    it('escapes fields containing quotes', () => {
      expect(escapeCsvField('hello "friend"', ',')).toBe('"hello ""friend"""')
    })

    it('escapes fields containing newlines', () => {
      expect(escapeCsvField('hello\nworld', ',')).toBe('"hello\nworld"')
    })

    it('does not escape if not needed', () => {
      expect(escapeCsvField('hello world', ',')).toBe('hello world')
    })
  })

  describe('generateCsvString', () => {
    it('generates a full CSV with headers and rows', () => {
      const header = ['Name', 'Value']
      const rows = [
        ['A', 10],
        ['B', 20],
      ]
      const result = generateCsvString(header, rows)
      expect(result).toBe('Name,Value\nA,10\nB,20')
    })

    it('uses custom delimiter', () => {
      const header = ['Name', 'Value']
      const rows = [['A', 10]]
      const result = generateCsvString(header, rows, { delimiter: ';' })
      expect(result).toBe('Name;Value\nA;10')
    })
  })
})
