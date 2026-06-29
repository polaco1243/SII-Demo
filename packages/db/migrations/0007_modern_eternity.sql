CREATE TYPE "public"."audit_event_type" AS ENUM('credencial_agregada', 'credencial_confirmada', 'credencial_eliminada', 'credencial_clave_actualizada', 'csv_subido', 'batch_confirmado', 'batch_cancelado', 'boleta_reintentada', 'archivo_procesado');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_email" text NOT NULL,
	"tipo" "audit_event_type" NOT NULL,
	"entidad_id" uuid,
	"razon_social_snapshot" text,
	"rut_snapshot" text,
	"descripcion" text NOT NULL,
	"detalle" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
