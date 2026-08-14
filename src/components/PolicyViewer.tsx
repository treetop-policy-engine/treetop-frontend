import { useState } from 'react'

type Props = {
  cedar?: string
  json?: unknown
}

export function PolicyViewer({ cedar, json }: Props) {
  const [format, setFormat] = useState<'cedar' | 'json'>(cedar ? 'cedar' : 'json')
  const effectiveFormat = format === 'cedar' && !cedar ? 'json' : format === 'json' && json === undefined ? 'cedar' : format
  const content = effectiveFormat === 'cedar' ? cedar : JSON.stringify(json, null, 2)

  return (
    <div className="policy-viewer">
      <div className="policy-viewer-toolbar">
        <span>Policy representation</span>
        <div className="policy-format-toggle" role="group" aria-label="Policy representation">
          <button type="button" className={effectiveFormat === 'cedar' ? 'active' : ''} disabled={!cedar} onClick={() => setFormat('cedar')}>Cedar</button>
          <button type="button" className={effectiveFormat === 'json' ? 'active' : ''} disabled={json === undefined} onClick={() => setFormat('json')}>JSON</button>
        </div>
      </div>
      <pre>{content}</pre>
    </div>
  )
}
