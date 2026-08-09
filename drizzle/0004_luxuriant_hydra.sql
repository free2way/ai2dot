CREATE TABLE "assistant_knowledge_bases" (
	"assistant_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_knowledge_bases_assistant_id_knowledge_base_id_pk" PRIMARY KEY("assistant_id","knowledge_base_id")
);
--> statement-breakpoint
ALTER TABLE "assistants" ADD COLUMN "avatar" text DEFAULT 'AI' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistants" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "assistants" ADD COLUMN "default_model_key" text;--> statement-breakpoint
ALTER TABLE "assistant_knowledge_bases" ADD CONSTRAINT "assistant_knowledge_bases_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_knowledge_bases" ADD CONSTRAINT "assistant_knowledge_bases_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_knowledge_bases_base_idx" ON "assistant_knowledge_bases" USING btree ("knowledge_base_id");