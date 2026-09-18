CREATE TYPE "public"."skill_source_type" AS ENUM('manual', 'github', 'url');--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"source_type" "skill_source_type" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"instructions" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_mcp" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_load" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skills_workspace_slug_idx" ON "skills" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "skills_workspace_enabled_idx" ON "skills" USING btree ("workspace_id","enabled");