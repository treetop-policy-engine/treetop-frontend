export type CedarPolicySegment = {
  source: string
  start: number
  end: number
  startLine: number
  endLine: number
}

function lineNumberAt(source: string, offset: number) {
  let line = 1
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') line += 1
  }
  return line
}

function segment(source: string, rawStart: number, rawEnd: number): CedarPolicySegment | undefined {
  let start = rawStart
  let end = rawEnd
  while (start < end && /\s/.test(source[start])) start += 1
  while (end > start && /\s/.test(source[end - 1])) end -= 1
  if (start === end) return undefined
  return {
    source: source.slice(start, end),
    start,
    end,
    startLine: lineNumberAt(source, start),
    endLine: lineNumberAt(source, end),
  }
}

export function cedarPolicySegments(source: string): CedarPolicySegment[] {
  const policies: CedarPolicySegment[] = []
  let start = 0
  let parentheses = 0
  let braces = 0
  let brackets = 0
  let state: 'code' | 'string' | 'line-comment' | 'block-comment' = 'code'

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (state === 'line-comment') {
      if (character === '\n') state = 'code'
      continue
    }
    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        state = 'code'
        index += 1
      }
      continue
    }
    if (state === 'string') {
      if (character === '\\') index += 1
      else if (character === '"') state = 'code'
      continue
    }

    if (character === '/' && next === '/') {
      state = 'line-comment'
      index += 1
    } else if (character === '/' && next === '*') {
      state = 'block-comment'
      index += 1
    } else if (character === '"') state = 'string'
    else if (character === '(') parentheses += 1
    else if (character === ')') parentheses -= 1
    else if (character === '{') braces += 1
    else if (character === '}') braces -= 1
    else if (character === '[') brackets += 1
    else if (character === ']') brackets -= 1
    else if (character === ';' && parentheses === 0 && braces === 0 && brackets === 0) {
      const policy = segment(source, start, index + 1)
      if (policy) policies.push(policy)
      start = index + 1
    }
  }

  const remainder = segment(source, start, source.length)
  if (remainder) policies.push(remainder)
  return policies
}

export function splitCedarPolicies(source: string): string[] {
  return cedarPolicySegments(source).map((policy) => policy.source)
}
