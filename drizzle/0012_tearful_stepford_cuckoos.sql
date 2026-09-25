CREATE TYPE "public"."platform_admin_role" AS ENUM('super_admin', 'operator', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."platform_admin_status" AS ENUM('active', 'locked', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "platform_admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "platform_admin_role" DEFAULT 'auditor' NOT NULL,
	"status" "platform_admin_status" DEFAULT 'active' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_sessions" ADD CONSTRAINT "platform_admin_sessions_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_admin_audit_created_idx" ON "platform_admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_admin_audit_admin_idx" ON "platform_admin_audit_logs" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admin_sessions_token_idx" ON "platform_admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "platform_admin_sessions_admin_idx" ON "platform_admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "platform_admin_sessions_expires_idx" ON "platform_admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_username_idx" ON "platform_admins" USING btree ("username");--> statement-breakpoint
CREATE INDEX "platform_admins_status_idx" ON "platform_admins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_status_updated_idx" ON "users" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "users_last_seen_idx" ON "users" USING btree ("last_seen_at");