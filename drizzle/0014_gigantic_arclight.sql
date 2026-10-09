CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."knowledge_embedding_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."knowledge_embedding_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_embedding_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "knowledge_embedding_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "embedding_status" "knowledge_embedding_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "embedded_chunk_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "embedding_error" text;--> statement-breakpoint
ALTER TABLE "knowledge_embedding_jobs" ADD CONSTRAINT "knowledge_embedding_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embedding_jobs" ADD CONSTRAINT "knowledge_embedding_jobs_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embedding_jobs" ADD CONSTRAINT "knowledge_embedding_jobs_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_embedding_jobs_document_idx" ON "knowledge_embedding_jobs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_embedding_jobs_claim_idx" ON "knowledge_embedding_jobs" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_embedding_jobs_workspace_idx" ON "knowledge_embedding_jobs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
INSERT INTO "knowledge_embedding_jobs" (
	"workspace_id",
	"knowledge_base_id",
	"document_id"
)
SELECT
	"knowledge_bases"."workspace_id",
	"knowledge_documents"."knowledge_base_id",
	"knowledge_documents"."id"
FROM "knowledge_documents"
INNER JOIN "knowledge_bases"
	ON "knowledge_bases"."id" = "knowledge_documents"."knowledge_base_id"
WHERE "knowledge_documents"."status" = 'ready'
ON CONFLICT ("document_id") DO NOTHING;
