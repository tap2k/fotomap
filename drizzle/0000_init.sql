CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'unlisted' NOT NULL,
	`lat` real,
	`lng` real,
	`zoom` real,
	`position` text DEFAULT 'a0' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_slug_unique` ON `channels` (`slug`);--> statement-breakpoint
CREATE INDEX `channels_parent` ON `channels` (`parent_id`);--> statement-breakpoint
CREATE INDEX `channels_owner` ON `channels` (`owner_id`);--> statement-breakpoint
CREATE TABLE `grants` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`role` text NOT NULL,
	`user_id` text,
	`token_hash` text,
	`email` text,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `grants_channel` ON `grants` (`channel_id`);--> statement-breakpoint
CREATE INDEX `grants_user` ON `grants` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `grants_token` ON `grants` (`token_hash`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`position` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`url` text,
	`thumb_url` text,
	`audio_url` text,
	`file_keys` text DEFAULT '[]' NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`lat` real,
	`lng` real,
	`taken_at` integer,
	`meta` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_channel` ON `items` (`channel_id`,`position`);--> statement-breakpoint
CREATE TABLE `login_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);