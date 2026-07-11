CREATE TYPE "public"."forma_pago_factura" AS ENUM('contado', 'credito', 'sin_costo');--> statement-breakpoint
CREATE TYPE "public"."tipo_compra" AS ENUM('del_giro', 'supermercados', 'bienes_raices', 'activo_fijo', 'iva_uso_comun', 'iva_no_recuperable', 'no_corresponde');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('boleta', 'factura');--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'factura_reintentada' BEFORE 'archivo_procesado';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "factura_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"nombre" text NOT NULL,
	"cantidad" integer NOT NULL,
	"unidad" text,
	"precio" integer NOT NULL,
	"pct_descuento" integer DEFAULT 0 NOT NULL,
	"subtotal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "facturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"factura_ref" text NOT NULL,
	"rut_contribuyente" text NOT NULL,
	"receptor_rut" text NOT NULL,
	"receptor_dv" text NOT NULL,
	"receptor_razon_social" text NOT NULL,
	"receptor_tipo_compra" "tipo_compra" DEFAULT 'del_giro' NOT NULL,
	"receptor_direccion" text NOT NULL,
	"receptor_comuna" text NOT NULL,
	"receptor_ciudad" text,
	"receptor_giro" text NOT NULL,
	"receptor_contacto" text,
	"rut_solicita" text,
	"dv_solicita" text,
	"rut_transporte" text,
	"dv_transporte" text,
	"patente" text,
	"rut_chofer" text,
	"dv_chofer" text,
	"nombre_chofer" text,
	"forma_pago" "forma_pago_factura" DEFAULT 'credito' NOT NULL,
	"pct_descuento_global" integer DEFAULT 0 NOT NULL,
	"monto_descuento_global" integer DEFAULT 0 NOT NULL,
	"monto_neto" integer DEFAULT 0 NOT NULL,
	"monto_total" integer DEFAULT 0 NOT NULL,
	"status" "boleta_status" DEFAULT 'pending' NOT NULL,
	"folio" text,
	"pdf_path" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "tipo_documento" "tipo_documento" DEFAULT 'boleta' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "facturas" ADD CONSTRAINT "facturas_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
