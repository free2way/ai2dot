CREATE TYPE "public"."notebook_artifact_status" AS ENUM('pending', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notebook_artifact_type" AS ENUM('summary', 'faq', 'timeline', 'study_guide', 'mind_map');--> statement-breakpoint
CREATE TYPE "public"."notebook_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "notebook_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notebook_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"type" "notebook_artifact_type" NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text,
	"structured_content" jsonb,
	"status" "notebook_artifact_status" DEFAULT 'pending' NOT NULL,
	"model_id" text,
	"source_snapshot_hash" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notebooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"assistant_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "notebook_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "notebook_id" uuid;--> statement-breakpoint
ALTER TABLE "notebook_artifacts" ADD CONSTRAINT "notebook_artifacts_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_artifacts" ADD CONSTRAINT "notebook_artifacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebook_artifacts_notebook_created_idx" ON "notebook_artifacts" USING btree ("notebook_id","created_at");--> statement-breakpoint
CREATE INDEX "notebook_artifacts_status_updated_idx" ON "notebook_artifacts" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notebooks_knowledge_base_idx" ON "notebooks" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX "notebooks_workspace_status_updated_idx" ON "notebooks" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_notebook_updated_idx" ON "conversations" USING btree ("notebook_id","updated_at");