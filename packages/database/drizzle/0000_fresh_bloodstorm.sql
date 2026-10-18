CREATE TABLE "canvas_leases" (
	"canvas_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"owner_url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Untitled' NOT NULL,
	"description" text,
	"nodes" jsonb DEFAULT '[]'::jsonb,
	"edges" jsonb DEFAULT '[]'::jsonb,
	"yjs_update" "bytea",
	"version" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
