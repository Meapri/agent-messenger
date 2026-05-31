import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const originalConsoleLog = console.log

const mockWithKakaoClient = mock(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
  return fn(mockClient)
})

const mockGetMessages = mock(() =>
  Promise.resolve([{ log_id: '1', message: 'Hello', sender_id: 'user-1', created_at: 1000 }]),
)

const mockSendMessage = mock(() => Promise.resolve({ log_id: '2', message: 'Hi there', created_at: 2000 }))

const mockMarkRead = mock(() =>
  Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', watermark: '42' }),
)
const mockReactMessage = mock(() =>
  Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42', reaction_type: 1 }),
)
const mockDeleteMessage = mock(() =>
  Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42' }),
)
const mockEditMessage = mock(() =>
  Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42', message: 'edited' }),
)
const mockSearchMessages = mock(() => Promise.resolve([{ log_id: '3', message: 'needle', sent_at: 3000 }]))
const mockDownloadAttachment = mock(() =>
  Promise.resolve({
    chat_id: 'chat-123',
    log_id: '42',
    filename: 'download.bin',
    mime_type: 'application/octet-stream',
    size: 4,
    url: 'https://talk.kakaocdn.net/file.bin',
    data: new Uint8Array([1, 2, 3, 4]),
  }),
)

const originalExit = process.exit
const downloadPath = join('/tmp', 'agent-messenger-kakao-download-test.bin')
const exportPath = join('/tmp', 'agent-messenger-kakao-export-test.jsonl')

const mockClient = {
  getMessages: mockGetMessages,
  sendMessage: mockSendMessage,
  markRead: mockMarkRead,
  reactMessage: mockReactMessage,
  deleteMessage: mockDeleteMessage,
  editMessage: mockEditMessage,
  searchMessages: mockSearchMessages,
  downloadAttachment: mockDownloadAttachment,
}

mock.module('./shared', () => ({
  withKakaoClient: mockWithKakaoClient,
}))

import { messageCommand } from './message'

describe('message commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(() => {
    mockWithKakaoClient.mockReset()
    mockGetMessages.mockReset()
    mockSendMessage.mockReset()
    mockMarkRead.mockReset()
    mockReactMessage.mockReset()
    mockDeleteMessage.mockReset()
    mockEditMessage.mockReset()
    mockSearchMessages.mockReset()
    mockDownloadAttachment.mockReset()

    mockWithKakaoClient.mockImplementation(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
      return fn(mockClient)
    })
    mockGetMessages.mockImplementation(() =>
      Promise.resolve([{ log_id: '1', message: 'Hello', sender_id: 'user-1', created_at: 1000 }]),
    )
    mockSendMessage.mockImplementation(() => Promise.resolve({ log_id: '2', message: 'Hi there', created_at: 2000 }))
    mockMarkRead.mockImplementation(() =>
      Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', watermark: '42' }),
    )
    mockReactMessage.mockImplementation(() =>
      Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42', reaction_type: 1 }),
    )
    mockDeleteMessage.mockImplementation(() =>
      Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42' }),
    )
    mockEditMessage.mockImplementation(() =>
      Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42', message: 'edited' }),
    )
    mockSearchMessages.mockImplementation(() => Promise.resolve([{ log_id: '3', message: 'needle', sent_at: 3000 }]))
    mockDownloadAttachment.mockImplementation(() =>
      Promise.resolve({
        chat_id: 'chat-123',
        log_id: '42',
        filename: 'download.bin',
        mime_type: 'application/octet-stream',
        size: 4,
        url: 'https://talk.kakaocdn.net/file.bin',
        data: new Uint8Array([1, 2, 3, 4]),
      }),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
  })

  afterEach(() => {
    console.log = originalConsoleLog
    process.exit = originalExit
    for (const path of [downloadPath, exportPath]) {
      if (existsSync(path)) unlinkSync(path)
    }
  })

  describe('list', () => {
    it('fetches messages for a chat room with default count', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '20'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 20, from: undefined })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].log_id).toBe('1')
      expect(output[0].message).toBe('Hello')
    })

    it('respects --count option', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '5'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 5, from: undefined })
    })

    it('respects --from option', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '20', '--from', '999'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 20, from: '999' })
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '20', '--account', 'my-account'], {
        from: 'user',
      })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })
  })

  describe('search', () => {
    it('searches messages with count/from options', async () => {
      await messageCommand.parseAsync(['search', 'chat-123', 'needle', '--count', '50', '--from', '99'], {
        from: 'user',
      })

      expect(mockSearchMessages).toHaveBeenCalledWith('chat-123', 'needle', {
        count: 50,
        from: '99',
        caseSensitive: undefined,
        regex: undefined,
      })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output[0].log_id).toBe('3')
    })

    it('forwards regex and case-sensitive flags', async () => {
      await messageCommand.parseAsync(
        ['search', 'chat-123', '^hello', '--count', '200', '--from', '0', '--regex', '--case-sensitive'],
        {
          from: 'user',
        },
      )

      expect(mockSearchMessages).toHaveBeenCalledWith('chat-123', '^hello', {
        count: 200,
        from: '0',
        caseSensitive: true,
        regex: true,
      })
    })
  })

  describe('export', () => {
    it('exports messages as jsonl to stdout', async () => {
      mockGetMessages.mockImplementationOnce(() =>
        Promise.resolve([
          {
            log_id: '1',
            type: 1,
            author_id: 7,
            author_name: 'Alice',
            message: 'Hello',
            attachment: null,
            sent_at: 1000,
          },
        ]),
      )

      await messageCommand.parseAsync(['export', 'chat-123', '--format', 'jsonl'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 200, from: undefined })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.log_id).toBe('1')
    })

    it('writes export output to a file and reports metadata', async () => {
      await messageCommand.parseAsync(['export', 'chat-123', '--format', 'jsonl', '--output', exportPath], {
        from: 'user',
      })

      expect(readFileSync(exportPath, 'utf8')).toContain('"log_id":"1"')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.path).toBe(exportPath)
      expect(output.format).toBe('jsonl')
    })
  })

  describe('send', () => {
    it('sends a message to a chat room', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', 'Hello world'], { from: 'user' })

      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', 'Hello world')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.log_id).toBe('2')
      expect(output.message).toBe('Hi there')
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', 'Hi', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })

    it('resolves --reply-to from chat history and sends a quoted reply', async () => {
      // given
      mockGetMessages.mockImplementation(() =>
        Promise.resolve([
          { log_id: '10', type: 1, author_id: 5, author_name: null, message: 'earlier', attachment: null, sent_at: 1 },
          { log_id: '42', type: 2, author_id: 7, author_name: null, message: 'target', attachment: null, sent_at: 2 },
        ]),
      )

      // when
      await messageCommand.parseAsync(['send', 'chat-123', 'replying', '--reply-to', '42'], { from: 'user' })

      // then
      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 100 })
      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', 'replying', {
        replyTo: { log_id: '42', author_id: 7, message: 'target', type: 2 },
      })
    })

    it('errors when --reply-to log-id is not found in recent history', async () => {
      // given
      mockGetMessages.mockImplementation(() =>
        Promise.resolve([
          { log_id: '10', type: 1, author_id: 5, author_name: null, message: 'earlier', attachment: null, sent_at: 1 },
        ]),
      )
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit

      // when / then
      try {
        await messageCommand.parseAsync(['send', 'chat-123', 'replying', '--reply-to', '999'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(mockSendMessage).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalled()
    })
  })

  describe('mark-read', () => {
    it('calls markRead with chat-id and log-id, no opts for normal chat', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42'], { from: 'user' })

      expect(mockMarkRead).toHaveBeenCalledWith('chat-123', '42', undefined)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ success: true, status_code: 0, chat_id: 'chat-123', watermark: '42' })
    })

    it('forwards --link-id when provided (open chat)', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42', '--link-id', '77777'], { from: 'user' })

      expect(mockMarkRead).toHaveBeenCalledWith('chat-123', '42', { linkId: '77777' })
    })

    it('--pretty prints pretty-formatted JSON (consistent with list/send)', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42', '--pretty'], { from: 'user' })

      const printed = consoleLogSpy.mock.calls[0][0] as string
      expect(printed).toContain('\n')
      expect(JSON.parse(printed)).toEqual({
        success: true,
        status_code: 0,
        chat_id: 'chat-123',
        watermark: '42',
      })
    })

    it('exits non-zero when result.success is false (e.g. open chat missing --link-id)', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit
      mockMarkRead.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -500, chat_id: 'chat-123', watermark: '42' }),
      )

      try {
        await messageCommand.parseAsync(['mark-read', 'chat-123', '42'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits zero on success', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit

      await messageCommand.parseAsync(['mark-read', 'chat-123', '42'], { from: 'user' })

      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })
  })

  describe('react', () => {
    it('adds the default reaction type to a message', async () => {
      await messageCommand.parseAsync(['react', 'chat-123', '42'], { from: 'user' })

      expect(mockReactMessage).toHaveBeenCalledWith('chat-123', '42', 1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42', reaction_type: 1 })
    })

    it('forwards a custom numeric reaction type', async () => {
      mockReactMessage.mockImplementationOnce(() =>
        Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42', reaction_type: 7 }),
      )

      await messageCommand.parseAsync(['react', 'chat-123', '42', '7'], { from: 'user' })

      expect(mockReactMessage).toHaveBeenCalledWith('chat-123', '42', 7)
    })

    it('exits non-zero when reaction result.success is false', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit
      mockReactMessage.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -203, chat_id: 'chat-123', log_id: '42', reaction_type: 1 }),
      )

      try {
        await messageCommand.parseAsync(['react', 'chat-123', '42'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['react', 'chat-123', '42', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })
  })

  describe('delete', () => {
    it('deletes a message by log-id', async () => {
      await messageCommand.parseAsync(['delete', 'chat-123', '42'], { from: 'user' })

      expect(mockDeleteMessage).toHaveBeenCalledWith('chat-123', '42')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ success: true, status_code: 0, chat_id: 'chat-123', log_id: '42' })
    })

    it('exits non-zero when delete result.success is false', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit
      mockDeleteMessage.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -203, chat_id: 'chat-123', log_id: '42' }),
      )

      try {
        await messageCommand.parseAsync(['delete', 'chat-123', '42'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['delete', 'chat-123', '42', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })
  })

  describe('edit', () => {
    it('edits a message by log-id', async () => {
      await messageCommand.parseAsync(['edit', 'chat-123', '42', 'edited'], { from: 'user' })

      expect(mockEditMessage).toHaveBeenCalledWith('chat-123', '42', 'edited')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({
        success: true,
        status_code: 0,
        chat_id: 'chat-123',
        log_id: '42',
        message: 'edited',
      })
    })

    it('exits non-zero when edit result.success is false', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit
      mockEditMessage.mockImplementationOnce(() =>
        Promise.resolve({
          success: false,
          status_code: -203,
          chat_id: 'chat-123',
          log_id: '42',
          message: 'edited',
        }),
      )

      try {
        await messageCommand.parseAsync(['edit', 'chat-123', '42', 'edited'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('download', () => {
    it('downloads attachment bytes to the requested output path', async () => {
      await messageCommand.parseAsync(['download', 'chat-123', '42', '--output', downloadPath], { from: 'user' })

      expect(mockDownloadAttachment).toHaveBeenCalledWith('chat-123', '42', {
        count: 200,
        urlKey: undefined,
        urlIndex: 0,
        allowExternal: undefined,
      })
      expect([...readFileSync(downloadPath)]).toEqual([1, 2, 3, 4])
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.path).toBe(downloadPath)
      expect(output.size).toBe(4)
      expect(output.data).toBeUndefined()
    })

    it('forwards URL selection options', async () => {
      await messageCommand.parseAsync(
        ['download', 'chat-123', '42', '--url-key', 'imageUrls', '--url-index', '1', '--allow-external-url'],
        { from: 'user' },
      )

      expect(mockDownloadAttachment).toHaveBeenCalledWith('chat-123', '42', {
        count: 200,
        urlKey: 'imageUrls',
        urlIndex: 1,
        allowExternal: true,
      })
    })
  })
})
