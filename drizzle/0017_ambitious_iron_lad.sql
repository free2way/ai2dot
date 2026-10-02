CREATE TYPE "public"."skill_context_target" AS ENUM('current_message', 'recent_messages', 'conversation');--> statement-breakpoint
CREATE TYPE "public"."skill_invocation_status" AS ENUM('resolved', 'included', 'omitted', 'blocked', 'awaiting_approval', 'completed', 'failed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."skill_mode" AS ENUM('auto', 'manual', 'hybrid');--> statement-breakpoint
CREATE TABLE "assistant_skills" (
	"assistant_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"skill_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_skills_assistant_id_position_pk" PRIMARY KEY("assistant_id","position")
);
--> statement-breakpoint
CREATE TABLE "generation_skill_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"skill_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"trigger" text NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"status" "skill_invocation_status" DEFAULT 'resolved' NOT NULL,
	"status_reason" text,
	"context_target" "skill_context_target" NOT NULL,
	"estimated_input_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dependency_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legacy_required_mcp" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_by_user_id" uuid,
	"change_notes" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistants" ADD COLUMN "skill_mode" "skill_mode" DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistants" ADD COLUMN "skill_context_target" "skill_context_target" DEFAULT 'recent_messages' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_branches" ADD COLUMN "skill_selection" jsonb;--> statement-breakpoint
ALTER TABLE "conversation_branches" ADD COLUMN "skill_selection_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "skill_resolution" jsonb;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "skill_selection_hash" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "parent_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "execution_plan_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_sources" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "catalog_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "current_version_id" uuid;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "policy_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT INTO "skill_versions" (
	"skill_id", "version", "name", "description", "instructions", "keywords",
	"dependency_manifest", "legacy_required_mcp", "content_hash", "change_notes"
)
SELECT
	"id", "version", "name", "description", "instructions", "keywords",
	'[]'::jsonb, "required_mcp", "content_hash", 'Migrated from the legacy mutable Skill record'
FROM "skills"
WHERE NOT EXISTS (
	SELECT 1 FROM "skill_versions" existing
	WHERE existing."skill_id" = "skills"."id"
		AND existing."content_hash" = "skills"."content_hash"
);--> statement-breakpoint
UPDATE "skills" AS s
SET "current_version_id" = v."id"
FROM "skill_versions" AS v
WHERE v."skill_id" = s."id" AND v."content_hash" = s."content_hash";--> statement-breakpoint
UPDATE "skills"
SET
	"catalog_id" = substring("slug" from '^builtin-(.+)$'),
	"category" = 'research'
WHERE "slug" IN (
	'builtin-web-research',
	'builtin-source-verification',
	'builtin-technical-docs',
	'builtin-github-project-research'
);--> statement-breakpoint
UPDATE "mcp_sources"
SET "template_id" = CASE
	WHEN rtrim("url", '/') = 'https://mcp.exa.ai/mcp' THEN 'exa'
	WHEN rtrim("url", '/') = 'https://mcp.tavily.com/mcp' THEN 'tavily'
	WHEN rtrim("url", '/') = 'https://mcp.context7.com/mcp' THEN 'context7'
	WHEN rtrim("url", '/') = 'https://api.githubcopilot.com/mcp/readonly' THEN 'github'
	ELSE "template_id"
END
WHERE "template_id" IS NULL;--> statement-breakpoint
ALTER TABLE "assistant_skills" ADD CONSTRAINT "assistant_skills_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_skills" ADD CONSTRAINT "assistant_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_skills" ADD CONSTRAINT "assistant_skills_skill_version_id_skill_versions_id_fk" FOREIGN KEY ("skill_version_id") REFERENCES "public"."skill_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_skill_invocations" ADD CONSTRAINT "generation_skill_invocations_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_skill_invocations" ADD CONSTRAINT "generation_skill_invocations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_skill_invocations" ADD CONSTRAINT "generation_skill_invocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_skill_invocations" ADD CONSTRAINT "generation_skill_invocations_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_skill_invocations" ADD CONSTRAINT "generation_skill_invocations_skill_version_id_skill_versions_id_fk" FOREIGN KEY ("skill_version_id") REFERENCES "public"."skill_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_skills_assistant_version_idx" ON "assistant_skills" USING btree ("assistant_id","skill_version_id");--> statement-breakpoint
CREATE INDEX "assistant_skills_skill_idx" ON "assistant_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_skill_invocations_position_idx" ON "generation_skill_invocations" USING btree ("generation_id","position");--> statement-breakpoint
CREATE INDEX "generation_skill_invocations_workspace_created_idx" ON "generation_skill_invocations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_versions_skill_hash_idx" ON "skill_versions" USING btree ("skill_id","content_hash");--> statement-breakpoint
CREATE INDEX "skill_versions_skill_created_idx" ON "skill_versions" USING btree ("skill_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_workspace_catalog_idx" ON "skills" USING btree ("workspace_id","catalog_id") WHERE "skills"."catalog_id" is not null;
