CREATE TYPE "public"."mcp_transport" AS ENUM('http', 'sse');--> statement-breakpoint
CREATE TABLE "mcp_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"transport" "mcp_transport" DEFAULT 'http' NOT NULL,
	"url" text NOT NULL,
	"encrypted_secret" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_sources" ADD CONSTRAINT "mcp_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_sources_workspace_idx" ON "mcp_sources" USING btree ("workspace_id");