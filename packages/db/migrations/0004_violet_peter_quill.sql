DELETE FROM "boletas";--> statement-breakpoint
DELETE FROM "batches";--> statement-breakpoint
CREATE TYPE "public"."metodo_pago" AS ENUM('debito', 'credito', 'efectivo', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_boleta" AS ENUM('exenta', 'afecta');--> statement-breakpoint
ALTER TABLE "boletas" ALTER COLUMN "detalle" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "rut_contribuyente" text NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "nombre_cliente" text NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "rut_cliente1" text NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "tipo_boleta" "tipo_boleta" NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "metodo_pago" "metodo_pago" NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "con_receptor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "receptor_rut" text;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "receptor_nombre" text;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "receptor_direccion" text;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "receptor_email" text;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "receptor_telefono" text;--> statement-breakpoint
ALTER TABLE "boletas" ADD COLUMN "con_detalle" boolean DEFAULT false NOT NULL;