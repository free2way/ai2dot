CREATE TABLE "notebook_video_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notebook_id" uuid NOT NULL,
	"knowledge_document_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"author_name" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"language" text,
	"transcript_origin" text NOT NULL,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebook_artifacts" ADD COLUMN "published_document_id" uuid;--> statement-breakpoint
ALTER TABLE "notebook_video_sources" ADD CONSTRAINT "notebook_video_sources_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_video_sources" ADD CONSTRAINT "notebook_video_sources_knowledge_document_id_knowledge_documents_id_fk" FOREIGN KEY ("knowledge_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_video_sources" ADD CONSTRAINT "notebook_video_sources_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notebook_video_sources_document_idx" ON "notebook_video_sources" USING btree ("knowledge_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notebook_video_sources_external_idx" ON "notebook_video_sources" USING btree ("notebook_id","platform","external_id");--> statement-breakpoint
CREATE INDEX "notebook_video_sources_notebook_updated_idx" ON "notebook_video_sources" USING btree ("notebook_id","updated_at");--> statement-breakpoint
ALTER TABLE "notebook_artifacts" ADD CONSTRAINT "notebook_artifacts_published_document_id_knowledge_documents_id_fk" FOREIGN KEY ("published_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE set null ON UPDATE no action;