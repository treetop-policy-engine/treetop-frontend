import { describe, expect, it } from 'vitest'
import { cedarSchema } from '../test/fixtures'
import { isSupportedField, parseCedarSchema, typeLabel } from './schema'

describe('parseCedarSchema', () => {
  it('indexes namespaces, action applicability, and entity shapes', () => {
    const model = parseCedarSchema(JSON.stringify(cedarSchema))
    expect(model.namespaces).toEqual(['App'])
    expect(model.entityByKey.get('App::Document')?.shape.attributes?.title.type).toBe('String')

    const read = model.actions.find(({ id }) => id === 'read')!
    expect(read.key).toBe('App::Action::read')
    expect(read.principalTypes).toEqual(['App::User'])
    expect(read.resourceTypes).toEqual(['App::Document'])
    expect(read.context.attributes?.environment.type).toBe('String')
    expect(read.context.attributes?.trusted.required).toBe(false)
  })

  it('marks action groups as non-invocable', () => {
    const model = parseCedarSchema(JSON.stringify(cedarSchema))
    expect(model.actions.find(({ id }) => id === 'allDocuments')?.invocable).toBe(false)
  })

  it('recognizes fields supported by the REST attribute encoding', () => {
    expect(isSupportedField({ type: 'Extension', name: 'ipaddr' })).toBe(true)
    expect(isSupportedField({ type: 'Record', attributes: {} })).toBe(false)
    expect(typeLabel({ type: 'Set', element: { type: 'String' } })).toBe('Set<String>')
  })
})

