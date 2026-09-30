import { requestUrl } from 'obsidian'

import { ToolRegistryImpl } from '../ToolRegistryImpl'

import { WebToolPack } from './WebToolPack'

jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
  htmlToMarkdown: jest.fn(),
}))

const request = requestUrl as jest.Mock
const registry = new ToolRegistryImpl()
new WebToolPack().registerAll(registry)
const run = (
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => {
  const entry = registry.resolve(name)
  if (!entry) throw new Error(`Unknown tool: ${name}`)
  return entry.handler(args, { conversationId: 'test', signal })
}
const response = (text: string, contentType = 'text/html', status = 200) => ({
  text,
  status,
  headers: { 'content-type': contentType },
  arrayBuffer: new TextEncoder().encode(text).buffer,
})

beforeEach(() => request.mockReset())

it('fetches readable page text with source and title, excluding scripts and styles', async () => {
  request.mockResolvedValue(
    response(
      '<html><head><title>Example</title><style>hidden</style></head><body><h1>Hello</h1><p>World &amp; more</p><script>secret()</script></body></html>',
    ),
  )
  const result = JSON.parse(
    await run('webfetch', { url: 'https://example.com', format: 'text' }),
  )
  expect(result.url).toBe('https://example.com')
  expect(result.title).toBe('Example')
  expect(result.content).toContain('World & more')
  expect(result.content).not.toMatch(/secret|hidden/)
})

it('limits the returned content and rejects unsupported URLs and binary pages', async () => {
  request.mockResolvedValue(response('abcdefgh', 'text/plain'))
  expect(
    JSON.parse(
      await run('webfetch', { url: 'https://example.com', maxCharacters: 3 }),
    ).content,
  ).toBe('abc\n\n[Output truncated at 3 characters]')
  await expect(run('webfetch', { url: 'file:///etc/passwd' })).rejects.toThrow(
    'Only HTTP',
  )
  request.mockResolvedValue(response('binary', 'application/octet-stream'))
  await expect(run('webfetch', { url: 'https://example.com' })).rejects.toThrow(
    'Unsupported web content',
  )
})

it.each(['json', 'sse'])(
  'returns Exa source links from a %s response',
  async (format) => {
    const content = 'Example\nhttps://example.com\nRelevant excerpt'
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: content }] },
    })
    request.mockResolvedValue(
      response(
        format === 'json'
          ? payload
          : `event: message\r\ndata: ${payload}\r\n\r\n`,
        'application/json',
      ),
    )
    expect(
      await run('web_search', {
        query: 'example',
        objective: 'Find primary sources',
      }),
    ).toBe(content)
    const options = request.mock.calls[0][0] as { body: string }
    const body = JSON.parse(options.body)
    expect(body.params.arguments).toEqual({
      query: 'example',
      objective: 'Find primary sources',
      numResults: 8,
    })
  },
)

it('reports remote search failures instead of returning them as search results', async () => {
  request.mockResolvedValue(
    response(
      JSON.stringify({
        id: 1,
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Rate limit exceeded' }],
        },
      }),
      'application/json',
    ),
  )
  await expect(
    run('web_search', { query: 'example', objective: 'Find sources' }),
  ).rejects.toThrow('Rate limit exceeded')
})

it('stops waiting when the conversation is cancelled', async () => {
  request.mockReturnValue(new Promise(() => {}))
  const controller = new AbortController()
  const result = run(
    'webfetch',
    { url: 'https://example.com' },
    controller.signal,
  )
  controller.abort()
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
})
