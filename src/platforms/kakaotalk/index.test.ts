import { expect, it } from 'bun:test'

import {
  classifyKakaoChat,
  CredentialManager,
  KakaoAccountCredentialsSchema,
  KakaoCredentialManager,
  KakaoChatSchema,
  KakaoConfigSchema,
  KakaoDeleteMessageResultSchema,
  KakaoDownloadAttachmentResultSchema,
  KakaoEditMessageResultSchema,
  KakaoMessageSchema,
  KakaoReactionResultSchema,
  KakaoSendResultSchema,
  KakaoTalkClient,
  KakaoTalkError,
  KakaoTalkListener,
  KakaoTalkPushDeletedMessageEventSchema,
  KakaoTalkPushEditedMessageEventSchema,
  KakaoTalkPushMemberEventSchema,
  KakaoTalkPushMessageEventSchema,
  KakaoProfileSchema,
  KakaoTalkPushReactionEventSchema,
  KakaoTalkPushReadEventSchema,
} from '@/platforms/kakaotalk/index'

it('KakaoTalkClient is exported from barrel', () => {
  expect(typeof KakaoTalkClient).toBe('function')
})

it('KakaoTalkError is exported from barrel', () => {
  expect(typeof KakaoTalkError).toBe('function')
})

it('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

it('KakaoCredentialManager is exported from barrel', () => {
  expect(typeof KakaoCredentialManager).toBe('function')
})

it('KakaoTalkListener is exported from barrel', () => {
  expect(typeof KakaoTalkListener).toBe('function')
})

it('KakaoChatSchema is exported from barrel', () => {
  expect(typeof KakaoChatSchema.parse).toBe('function')
})

it('KakaoMessageSchema is exported from barrel', () => {
  expect(typeof KakaoMessageSchema.parse).toBe('function')
})

it('KakaoSendResultSchema is exported from barrel', () => {
  expect(typeof KakaoSendResultSchema.parse).toBe('function')
})

it('KakaoReactionResultSchema is exported from barrel', () => {
  expect(typeof KakaoReactionResultSchema.parse).toBe('function')
})

it('KakaoDeleteMessageResultSchema is exported from barrel', () => {
  expect(typeof KakaoDeleteMessageResultSchema.parse).toBe('function')
})

it('KakaoEditMessageResultSchema is exported from barrel', () => {
  expect(typeof KakaoEditMessageResultSchema.parse).toBe('function')
})

it('KakaoDownloadAttachmentResultSchema is exported from barrel', () => {
  expect(typeof KakaoDownloadAttachmentResultSchema.parse).toBe('function')
})

it('KakaoAccountCredentialsSchema is exported from barrel', () => {
  expect(typeof KakaoAccountCredentialsSchema.parse).toBe('function')
})

it('KakaoConfigSchema is exported from barrel', () => {
  expect(typeof KakaoConfigSchema.parse).toBe('function')
})

it('KakaoTalkPushMessageEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushMessageEventSchema.parse).toBe('function')
})

it('KakaoTalkPushMemberEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushMemberEventSchema.parse).toBe('function')
})

it('KakaoTalkPushReadEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushReadEventSchema.parse).toBe('function')
})

it('KakaoTalkPushReactionEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushReactionEventSchema.parse).toBe('function')
})

it('KakaoTalkPushDeletedMessageEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushDeletedMessageEventSchema.parse).toBe('function')
})

it('KakaoTalkPushEditedMessageEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushEditedMessageEventSchema.parse).toBe('function')
})

it('KakaoProfileSchema is exported from barrel', () => {
  expect(typeof KakaoProfileSchema.parse).toBe('function')
})

it('classifyKakaoChat is exported from barrel', () => {
  expect(typeof classifyKakaoChat).toBe('function')
})
