CREATE TYPE "public"."generation_status" AS ENUM('pending', 'streaming', 'completed', 'stopped', 'failed', 'unresolved');--> statement-breakpoint
CREATE TABLE "conversation_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"parent_branch_id" uuid,
	"forked_from_client_message_id" text,
	"name" text DEFAULT '主分支' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"model_id" uuid,
	"provider_model_id" text NOT NULL,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"response_message" jsonb,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "messages_conversation_client_id_idx";--> statement-breakpoint
DROP INDEX "messages_conversation_sequence_idx";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "conversation_branches" ADD CONSTRAINT "conversation_branches_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_branch_id_conversation_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."conversation_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_branches_conversation_idx" ON "conversation_branches" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_branches_default_idx" ON "conversation_branches" USING btree ("conversation_id") WHERE "conversation_branches"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "generations_workspace_idempotency_idx" ON "generations" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "generations_conversation_created_idx" ON "generations" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "generations_status_updated_idx" ON "generations" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_branch_id_conversation_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."conversation_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_branch_client_id_idx" ON "messages" USING btree ("branch_id","client_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_branch_sequence_idx" ON "messages" USING btree ("branch_id","sequence");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");