ALTER TABLE `channels` ADD `domain` text;--> statement-breakpoint
CREATE UNIQUE INDEX `channels_domain_unique` ON `channels` (`domain`);