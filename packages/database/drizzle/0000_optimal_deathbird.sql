CREATE TABLE `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Untitled' NOT NULL,
	`description` text,
	`nodes` text DEFAULT '[]',
	`edges` text DEFAULT '[]',
	`yjs_update` text,
	`version` integer DEFAULT 0 NOT NULL,
	`owner_id` text,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`supabase_id` text,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_supabase_id_unique` ON `users` (`supabase_id`);