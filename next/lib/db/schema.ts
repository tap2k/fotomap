import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ChannelSettings, ItemMeta } from '@/lib/types';

const now = () => new Date();

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] }).notNull().default('free'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // sha256 of the cookie token
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export const loginTokens = sqliteTable('login_tokens', {
  id: text('id').primaryKey(), // sha256 of the emailed token
  email: text('email').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    parentId: text('parent_id'),
    ownerId: text('owner_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    visibility: text('visibility', { enum: ['private', 'unlisted', 'public'] }).notNull().default('unlisted'),
    lat: real('lat'),
    lng: real('lng'),
    zoom: real('zoom'),
    // Custom domain (e.g. stories.example.org) that serves this project at '/'.
    domain: text('domain').unique(),
    position: text('position').notNull().default('a0'),
    settings: text('settings', { mode: 'json' }).$type<ChannelSettings>().notNull().default({}),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
  },
  (t) => [index('channels_parent').on(t.parentId), index('channels_owner').on(t.ownerId)],
);

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
    position: text('position').notNull(),
    kind: text('kind', { enum: ['image', 'video', 'audio', 'embed', 'text'] }).notNull(),
    status: text('status', { enum: ['draft', 'pending', 'published'] }).notNull().default('published'),
    url: text('url'),
    thumbUrl: text('thumb_url'),
    audioUrl: text('audio_url'),
    fileKeys: text('file_keys', { mode: 'json' }).$type<string[]>().notNull().default([]),
    bytes: integer('bytes').notNull().default(0),
    title: text('title').notNull().default(''),
    caption: text('caption').notNull().default(''),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    lat: real('lat'),
    lng: real('lng'),
    takenAt: integer('taken_at', { mode: 'timestamp' }),
    meta: text('meta', { mode: 'json' }).$type<ItemMeta>().notNull().default({}),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
  },
  (t) => [index('items_channel').on(t.channelId, t.position)],
);

// Who can do what on a channel (and its descendants). Exactly one of
// userId / tokenHash / email is set: a member, a share link, or a pending invite.
export const grants = sqliteTable(
  'grants',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'editor', 'viewer', 'submitter'] }).notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash'),
    email: text('email'),
    label: text('label').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
  },
  (t) => [
    index('grants_channel').on(t.channelId),
    index('grants_user').on(t.userId),
    uniqueIndex('grants_token').on(t.tokenHash),
  ],
);

export type User = typeof users.$inferSelect;
export type ChannelRow = typeof channels.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type GrantRow = typeof grants.$inferSelect;
export type Role = GrantRow['role'];
