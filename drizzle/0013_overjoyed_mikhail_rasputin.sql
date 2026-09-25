CREATE TYPE "public"."mcp_tool_audit_status" AS ENUM('requested', 'approved', 'denied', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mcp_tool_risk" AS ENUM('read', 'write', 'destructive', 'unknown');--> statement-breakpoint
CREATE TABLE "assistant_mcp_sources" (
	"assistant_id" uuid NOT NULL,
	"mcp_source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_mcp_sources_assistant_id_mcp_source_id_pk" PRIMARY KEY("assistant_id","mcp_source_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_tool_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"generation_id" uuid,
	"mcp_source_id" uuid,
	"approval_id" text,
	"tool_call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"risk" "mcp_tool_risk" DEFAULT 'unknown' NOT NULL,
	"status" "mcp_tool_audit_status" DEFAULT 'requested' NOT NULL,
	"input" jsonb,
	"output_summary" text,
	"error_message" text,
	"approved_by_user_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_mcp_sources" ADD CONSTRAINT "assistant_mcp_sources_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_mcp_sources" ADD CONSTRAINT "assistant_mcp_sources_mcp_source_id_mcp_sources_id_fk" FOREIGN KEY ("mcp_source_id") REFERENCES "public"."mcp_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_audit_logs" ADD CONSTRAINT "mcp_tool_audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_audit_logs" ADD CONSTRAINT "mcp_tool_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_audit_logs" ADD CONSTRAINT "mcp_tool_audit_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_audit_logs" ADD CONSTRAINT "mcp_tool_audit_logs_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_audit_logs" ADD CONSTRAINT "mcp_tool_audit_logs_mcp_source_id_mcp_sources_id_fk" FOREIGN KEY ("mcp_source_id") REFERENCES "public"."mcp_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_audit_logs" ADD CONSTRAINT "mcp_tool_audit_logs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_mcp_sources_source_idx" ON "assistant_mcp_sources" USING btree ("mcp_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tool_audit_workspace_call_idx" ON "mcp_tool_audit_logs" USING btree ("workspace_id","tool_call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tool_audit_approval_idx" ON "mcp_tool_audit_logs" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "mcp_tool_audit_workspace_created_idx" ON "mcp_tool_audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_tool_audit_conversation_created_idx" ON "mcp_tool_audit_logs" USING btree ("conversation_id","created_at");