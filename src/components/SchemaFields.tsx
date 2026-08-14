import { AlertTriangle } from 'lucide-react'
import { isSupportedField, type CedarType, typeLabel } from '../domain/schema'

type Props = {
  record: CedarType
  values: Record<string, string>
  included: Record<string, boolean>
  onValue: (name: string, value: string) => void
  onIncluded: (name: string, value: boolean) => void
  emptyLabel: string
  exclude?: readonly string[]
}

function placeholderFor(type: CedarType) {
  if (type.type === 'Boolean') return 'true or false'
  if (type.type === 'Long') return '0'
  if (type.type === 'Extension') return type.name === 'ipaddr' ? '10.0.0.1' : type.name ?? ''
  if (type.type === 'Set') return 'Comma-separated values'
  return 'Enter a value'
}

export function SchemaFields({ record, values, included, onValue, onIncluded, emptyLabel, exclude = [] }: Props) {
  const fields = Object.entries(record.attributes ?? {}).filter(([name]) => !exclude.includes(name))
  if (!fields.length) return <p className="field-empty">{emptyLabel}</p>

  return (
    <div className="schema-fields">
      {fields.map(([name, type]) => {
        const required = type.required !== false
        const enabled = required || Boolean(included[name])
        const supported = isSupportedField(type)
        const description = type.annotations?.doc

        return (
          <div className={`schema-field ${!enabled ? 'optional-off' : ''}`} key={name}>
            <div className="schema-field-heading">
              <label htmlFor={`schema-field-${name}`}>
                {name}
                <span className="type-badge">{typeLabel(type)}</span>
                {required ? <span className="required">required</span> : <span className="optional">optional</span>}
              </label>
              {!required && supported && (
                <label className="include-toggle">
                  <input type="checkbox" checked={enabled} onChange={(event) => onIncluded(name, event.target.checked)} />
                  Include
                </label>
              )}
            </div>
            {description && <small className="field-help">{description}</small>}
            {supported ? (
              type.type === 'Boolean' ? (
                <select
                  id={`schema-field-${name}`}
                  value={values[name] ?? ''}
                  onChange={(event) => onValue(name, event.target.value)}
                  disabled={!enabled}
                >
                  <option value="">Select…</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  id={`schema-field-${name}`}
                  type={type.type === 'Long' ? 'number' : 'text'}
                  value={values[name] ?? ''}
                  onChange={(event) => onValue(name, event.target.value)}
                  placeholder={placeholderFor(type)}
                  disabled={!enabled}
                />
              )
            ) : (
              <div className="unsupported-field"><AlertTriangle size={15} /> Use raw JSON for {typeLabel(type)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
