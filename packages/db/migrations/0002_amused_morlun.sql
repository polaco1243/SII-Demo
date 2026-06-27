CREATE TYPE "public"."credential_status" AS ENUM('pendiente', 'descubriendo', 'pendiente_seleccion', 'lista', 'error');--> statement-breakpoint
ALTER TABLE "sii_credentials" ALTER COLUMN "emisor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sii_credentials" ADD COLUMN "emisor_rut" text;--> statement-breakpoint
ALTER TABLE "sii_credentials" ADD COLUMN "emisor_razon_social" text;--> statement-breakpoint
ALTER TABLE "sii_credentials" ADD COLUMN "emisores_disponibles" jsonb;--> statement-breakpoint
ALTER TABLE "sii_credentials" ADD COLUMN "status" "credential_status" DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "sii_credentials" ADD COLUMN "error_message" text;