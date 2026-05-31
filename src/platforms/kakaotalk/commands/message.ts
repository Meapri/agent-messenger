import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { KakaoMessage, KakaoReplyTarget } from '../types'
import { withKakaoClient } from './shared'

async function listAction(
  chatId: string,
  options: { account?: string; count?: string; from?: string; pretty?: boolean },
): Promise<void> {
  try {
    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const messages = await withKakaoClient(options, (client) =>
      client.getMessages(chatId, { count, from: options.from }),
    )
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function sendAction(
  chatId: string,
  text: string,
  options: { account?: string; pretty?: boolean; replyTo?: string },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, async (client) => {
      if (options.replyTo === undefined) {
        return client.sendMessage(chatId, text)
      }

      const target = await resolveReplyTarget(client, chatId, options.replyTo)
      return client.sendMessage(chatId, text, { replyTo: target })
    })
    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

// A reply attachment needs the source message's author, text, and type — not
// just its log_id — so we look it up in the chat's recent history.
async function resolveReplyTarget(
  client: {
    getMessages: (chatId: string, opts: { count: number }) => Promise<KakaoMessage[]>
  },
  chatId: string,
  logId: string,
): Promise<KakaoReplyTarget> {
  const messages = await client.getMessages(chatId, { count: 100 })
  const source = messages.find((m) => m.log_id === logId)
  if (!source) {
    throw new Error(`Reply target log-id ${logId} not found in the latest 100 messages of chat ${chatId}`)
  }
  return {
    log_id: source.log_id,
    author_id: source.author_id,
    message: source.message,
    type: source.type,
  }
}

type UploadKind = 'auto' | 'photo' | 'video' | 'audio' | 'file' | 'multi'

async function uploadAction(
  chatId: string,
  filePaths: string[],
  options: { account?: string; pretty?: boolean; as?: UploadKind; mime?: string },
): Promise<void> {
  try {
    const kind: UploadKind = options.as ?? (filePaths.length > 1 ? 'multi' : 'auto')

    const result = await withKakaoClient(options, async (client) => {
      if (kind === 'multi') {
        if (filePaths.length < 2) {
          throw new Error('--as=multi requires 2 or more files')
        }
        return client.sendMultiPhoto(
          chatId,
          filePaths.map((p) => ({ data: readFileSync(resolve(p)), filename: basename(p) })),
        )
      }

      if (filePaths.length !== 1) {
        throw new Error(`--as=${kind} accepts exactly one file path`)
      }
      const path = resolve(filePaths[0]!)
      const data = readFileSync(path)
      const filename = basename(path)

      switch (kind) {
        case 'auto':
          return client.sendAttachment(chatId, data, filename, options.mime)
        case 'photo':
          return client.sendPhoto(chatId, data, filename)
        case 'video':
          return client.sendVideo(chatId, data, filename)
        case 'audio':
          return client.sendAudio(chatId, data, filename)
        case 'file':
          return client.sendFile(chatId, data, filename, options.mime ?? 'application/octet-stream')
      }
    })
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

type ExportFormat = 'json' | 'jsonl' | 'csv' | 'txt'

function parseExportFormat(format: string | undefined): ExportFormat {
  const value = format ?? 'json'
  if (value === 'json' || value === 'jsonl' || value === 'csv' || value === 'txt') return value
  throw new Error(`Invalid export format: ${value}`)
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function formatMessagesForExport(messages: KakaoMessage[], format: ExportFormat, pretty?: boolean): string {
  switch (format) {
    case 'json':
      return formatOutput(messages, pretty)
    case 'jsonl':
      return messages.map((message) => JSON.stringify(message)).join('\n')
    case 'csv': {
      const rows = [
        ['log_id', 'sent_at', 'author_id', 'author_name', 'type', 'message', 'attachment'],
        ...messages.map((message) => [
          message.log_id,
          message.sent_at,
          message.author_id,
          message.author_name,
          message.type,
          message.message,
          message.attachment ? JSON.stringify(message.attachment) : '',
        ]),
      ]
      return rows.map((row) => row.map(csvCell).join(',')).join('\n')
    }
    case 'txt':
      return messages
        .map((message) => {
          const author = message.author_name ?? String(message.author_id)
          return `[${message.sent_at}] ${author}: ${message.message}`
        })
        .join('\n')
  }
}

async function searchAction(
  chatId: string,
  query: string,
  options: {
    account?: string
    count?: string
    from?: string
    caseSensitive?: boolean
    regex?: boolean
    pretty?: boolean
  },
): Promise<void> {
  try {
    const count = options.count ? Number.parseInt(options.count, 10) : 200
    const messages = await withKakaoClient(options, (client) =>
      client.searchMessages(chatId, query, {
        count,
        from: options.from,
        caseSensitive: options.caseSensitive,
        regex: options.regex,
      }),
    )
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function exportAction(
  chatId: string,
  options: {
    account?: string
    count?: string
    from?: string
    format?: string
    output?: string
    pretty?: boolean
  },
): Promise<void> {
  try {
    const count = options.count ? Number.parseInt(options.count, 10) : 200
    const format = parseExportFormat(options.format)
    const messages = await withKakaoClient(options, (client) =>
      client.getMessages(chatId, { count, from: options.from }),
    )
    const output = formatMessagesForExport(messages, format, options.pretty)
    if (options.output) {
      writeFileSync(resolve(options.output), output)
      console.log(formatOutput({ path: resolve(options.output), count: messages.length, format }, options.pretty))
      return
    }
    console.log(output)
  } catch (error) {
    handleError(error as Error)
  }
}

async function downloadAction(
  chatId: string,
  logId: string,
  options: {
    account?: string
    count?: string
    output?: string
    urlKey?: string
    urlIndex?: string
    allowExternalUrl?: boolean
    pretty?: boolean
  },
): Promise<void> {
  try {
    const count = options.count ? Number.parseInt(options.count, 10) : 200
    const urlIndex = options.urlIndex ? Number.parseInt(options.urlIndex, 10) : undefined
    const result = await withKakaoClient(options, (client) =>
      client.downloadAttachment(chatId, logId, {
        count,
        urlKey: options.urlKey,
        urlIndex,
        allowExternal: options.allowExternalUrl,
      }),
    )
    const path = resolve(options.output ?? result.filename)
    writeFileSync(path, Buffer.from(result.data))
    console.log(
      formatOutput(
        {
          chat_id: result.chat_id,
          log_id: result.log_id,
          filename: result.filename,
          mime_type: result.mime_type,
          size: result.size,
          url: result.url,
          path,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function markReadAction(
  chatId: string,
  logId: string,
  options: { account?: string; linkId?: string; pretty?: boolean },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) =>
      client.markRead(chatId, logId, options.linkId !== undefined ? { linkId: options.linkId } : undefined),
    )
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function editAction(
  chatId: string,
  logId: string,
  text: string,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) => client.editMessage(chatId, logId, text))
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function reactAction(
  chatId: string,
  logId: string,
  reactionType: string | undefined,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    const parsedReactionType = reactionType === undefined ? 1 : Number.parseInt(reactionType, 10)
    if (!Number.isInteger(parsedReactionType) || parsedReactionType < 1) {
      throw new Error(`Invalid reaction type: ${reactionType}`)
    }
    const result = await withKakaoClient(options, (client) => client.reactMessage(chatId, logId, parsedReactionType))
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function deleteAction(
  chatId: string,
  logId: string,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) => client.deleteMessage(chatId, logId))
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('KakaoTalk message commands')
  .addCommand(
    new Command('list')
      .description('List messages in a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('-n, --count <number>', 'Number of messages to fetch', '20')
      .option('--from <log-id>', 'Fetch messages starting from this log ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('search')
      .description('Search recent messages in a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<query>', 'Search query')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('-n, --count <number>', 'Number of recent messages to scan', '200')
      .option('--from <log-id>', 'Fetch messages starting from this log ID')
      .option('--case-sensitive', 'Use case-sensitive matching')
      .option('--regex', 'Treat query as a JavaScript regular expression')
      .option('--pretty', 'Pretty print JSON output')
      .action(searchAction),
  )
  .addCommand(
    new Command('export')
      .description('Export recent messages from a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('-n, --count <number>', 'Number of messages to export', '200')
      .option('--from <log-id>', 'Fetch messages starting from this log ID')
      .option('--format <format>', 'Export format: json | jsonl | csv | txt', 'json')
      .option('-o, --output <path>', 'Write export to a file instead of stdout')
      .option('--pretty', 'Pretty print JSON output')
      .action(exportAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--reply-to <log-id>', 'Send as a quoted reply to this message log ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('upload')
      .description(
        'Send one or more files to a chat. MIME is sniffed from the filename (or --mime) and dispatched to the matching KakaoTalk message_type. Pass 2+ files (or --as=multi) for a multi-photo gallery.',
      )
      .argument('<chat-id>', 'Chat room ID')
      .argument('<file-paths...>', 'One or more file paths')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--as <kind>', 'Force a specific kind: auto | photo | video | audio | file | multi')
      .option('--mime <type>', 'Override MIME type (otherwise inferred from filename)')
      .option('--pretty', 'Pretty print JSON output')
      .action(uploadAction),
  )
  .addCommand(
    new Command('download')
      .description('Download the media attachment from a message')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<log-id>', 'Message log ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('-n, --count <number>', 'Number of recent messages to scan for the log ID', '200')
      .option('-o, --output <path>', 'Write attachment to this file path (default: attachment filename)')
      .option('--url-key <key>', 'Use a specific attachment URL field')
      .option('--url-index <number>', 'Use a specific URL index when multiple URLs exist', '0')
      .option('--allow-external-url', 'Allow non-Kakao attachment URLs')
      .option('--pretty', 'Pretty print JSON output')
      .action(downloadAction),
  )
  .addCommand(
    new Command('edit')
      .description('Edit a KakaoTalk message by log ID (experimental; some device profiles reject REWRITE)')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<log-id>', 'Message log ID')
      .argument('<text>', 'Replacement message text')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(editAction),
  )
  .addCommand(
    new Command('mark-read')
      .description('Mark messages in a chat room as read up to a given log ID')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<log-id>', 'Watermark log ID (mark messages up to and including this log_id as read)')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--link-id <li>', 'Open-chat link ID (REQUIRED for open chats / 오픈채팅)')
      .option('--pretty', 'Pretty print JSON output')
      .action(markReadAction),
  )
  .addCommand(
    new Command('react')
      .description('Add a reaction to a KakaoTalk message')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<log-id>', 'Message log ID')
      .argument('[reaction-type]', 'Numeric KakaoTalk reaction type (default: 1)', '1')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(reactAction),
  )
  .addCommand(
    new Command('delete')
      .description('Delete a KakaoTalk message by log ID')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<log-id>', 'Message log ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(deleteAction),
  )
