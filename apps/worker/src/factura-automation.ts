import { chromium, type Browser, type Page } from "playwright";
import { writeFile } from "node:fs/promises";

const LOGIN_URL = "https://www1.sii.cl/cgi-bin/Portal001/mipeLaunchPage.cgi?OPCION=34&TIPO=4";
const GENERAR_URL = "https://www1.sii.cl/cgi-bin/Portal001/mipeGenFacEx.cgi?PTDC_CODIGO=34";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TipoCompra =
  | "del_giro"
  | "supermercados"
  | "bienes_raices"
  | "activo_fijo"
  | "iva_uso_comun"
  | "iva_no_recuperable"
  | "no_corresponde";

export type FormaPagoFactura = "contado" | "credito" | "sin_costo";

export interface FacturaItemInput {
  nombre: string;
  cantidad: number;
  unidad?: string | null;
  precio: number;
  pctDescuento?: number;
}

export interface FacturaInput {
  facturaRef: string;
  receptorRut: string;
  receptorDv: string;
  receptorRazonSocial: string;
  receptorTipoCompra: TipoCompra;
  receptorDireccion: string;
  receptorComuna: string;
  receptorCiudad?: string | null;
  receptorGiro: string;
  receptorContacto?: string | null;
  rutSolicita?: string | null;
  dvSolicita?: string | null;
  rutTransporte?: string | null;
  dvTransporte?: string | null;
  patente?: string | null;
  rutChofer?: string | null;
  dvChofer?: string | null;
  nombreChofer?: string | null;
  formaPago: FormaPagoFactura;
  pctDescuentoGlobal?: number;
  items: FacturaItemInput[];
}

export interface FacturaResultado {
  facturaRef: string;
  exito: boolean;
  folio?: string;
  pdfPath?: string;
  error?: string;
}

const VALUE_TIPO_COMPRA: Record<TipoCompra, string> = {
  del_giro: "1",
  supermercados: "2",
  bienes_raices: "3",
  activo_fijo: "4",
  iva_uso_comun: "5",
  iva_no_recuperable: "6",
  no_corresponde: "7",
};

const VALUE_FORMA_PAGO: Record<FormaPagoFactura, string> = {
  contado: "1",
  credito: "2",
  sin_costo: "3",
};

export class SIIFacturaAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(
    private readonly rut: string,
    private readonly clave: string,
    private readonly descargasDir: string,
    private readonly headless = true,
  ) {}

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: this.headless });
    this.page = await this.browser.newPage({
      acceptDownloads: true,
      viewport: { width: 1366, height: 900 },
      locale: "es-CL",
      timezoneId: "America/Santiago",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
  }

  async stop(): Promise<void> {
    await this.browser?.close();
  }

  private get p(): Page {
    if (!this.page) throw new Error("Automation no iniciada");
    return this.page;
  }

  private async capturarDiagnostico(etiqueta: string): Promise<string> {
    const timestamp = Date.now();
    const screenshotPath = `${this.descargasDir}/debug_factura_${etiqueta}_${timestamp}.png`;
    try {
      await this.p.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      // si tampoco se puede capturar pantalla, seguimos con lo que sí tenemos
    }
    const url = this.p.url();
    const title = await this.p.title().catch(() => "?");
    const textoVisible = await this.p
      .evaluate(() => document.body?.innerText?.slice(0, 300) ?? "")
      .catch(() => "");
    return `url=${url} | title="${title}" | screenshot=${screenshotPath} | texto="${textoVisible.replace(/\s+/g, " ").trim()}"`;
  }

  private async login(): Promise<void> {
    await this.p.goto(LOGIN_URL);
    await this.p.waitForLoadState("networkidle");
    try {
      await this.p.waitForSelector("#rutcntr", { state: "visible", timeout: 20000 });
    } catch {
      const diagnostico = await this.capturarDiagnostico("login_no_aparecio");
      throw new Error(`No apareció el formulario de login del SII. Diagnóstico: ${diagnostico}`);
    }
    await this.p.fill("#rutcntr", this.rut);
    await this.p.fill("#clave", this.clave);
    await this.p.click("button:has-text('INGRESAR')");
    await this.p.waitForLoadState("networkidle");
  }

  // La página de selección de empresa solo aparece si la credencial tiene
  // más de una razón social asociada; si solo hay una, el SII salta directo
  // al formulario de factura.
  private async seleccionarEmpresa(razonSocialEsperada: string): Promise<void> {
    const enFormularioFactura = await this.p
      .locator("input[name=EFXP_RZN_SOC]")
      .count()
      .then((n) => n > 0);
    if (enFormularioFactura) return;

    const opciones = await this.p.evaluate(() => {
      const select = document.querySelector("select");
      return select
        ? Array.from(select.options).map((o) => ({ value: o.value, text: (o.textContent ?? "").trim() }))
        : [];
    });
    const opcion = opciones.find((o) => o.text.toUpperCase().includes(razonSocialEsperada.toUpperCase()));
    if (!opcion) {
      const diagnostico = await this.capturarDiagnostico("empresa_no_encontrada");
      throw new Error(
        `No se encontró la empresa "${razonSocialEsperada}" en el selector de empresas. Diagnóstico: ${diagnostico}`,
      );
    }
    await this.p.selectOption("select", opcion.value);
    await this.p.click("button[type=submit]");
    await this.p.waitForLoadState("networkidle").catch(() => {});
    await sleep(1000);
  }

  // Chequeo de seguridad: el emisor autocompletado por el SII debe coincidir
  // con la razón social guardada en la credencial, para no emitir una
  // factura a nombre de la empresa equivocada si la sesión quedó mezclada.
  private async validarRazonSocialEmisor(razonSocialEsperada: string): Promise<void> {
    const valorActual = await this.p.inputValue("input[name=EFXP_RZN_SOC]").catch(() => "");
    if (!valorActual || !valorActual.toUpperCase().includes(razonSocialEsperada.toUpperCase())) {
      const diagnostico = await this.capturarDiagnostico("razon_social_no_coincide");
      throw new Error(
        `La razón social del formulario ("${valorActual}") no coincide con la credencial configurada ("${razonSocialEsperada}"). Diagnóstico: ${diagnostico}`,
      );
    }
  }

  private async fillReceptor(f: FacturaInput): Promise<void> {
    await this.p.fill("#EFXP_RUT_RECEP", f.receptorRut);
    await this.p.fill("#EFXP_DV_RECEP", f.receptorDv);
    await this.p.fill("input[name=EFXP_RZN_SOC_RECEP]", f.receptorRazonSocial);
    await this.p.selectOption("select[name=EFXP_TIPOCOMPRA_SELECT]", VALUE_TIPO_COMPRA[f.receptorTipoCompra]);
    await this.p.fill("input[name=EFXP_DIR_RECEP]", f.receptorDireccion);
    await this.p.fill("input[name=EFXP_CMNA_RECEP]", f.receptorComuna);
    if (f.receptorCiudad) await this.p.fill("input[name=EFXP_CIUDAD_RECEP]", f.receptorCiudad);
    await this.p.fill("input[name=EFXP_GIRO_RECEP]", f.receptorGiro);
    if (f.receptorContacto) await this.p.fill("input[name=EFXP_CONTACTO]", f.receptorContacto);
    if (f.rutSolicita) await this.p.fill("input[name=EFXP_RUT_SOLICITA]", f.rutSolicita);
    if (f.dvSolicita) await this.p.fill("input[name=EFXP_DV_SOLICITA]", f.dvSolicita);
  }

  private async fillTransporte(f: FacturaInput): Promise<void> {
    if (f.rutTransporte) await this.p.fill("#EFXP_RUT_TRANSPORTE", f.rutTransporte);
    if (f.dvTransporte) await this.p.fill("#EFXP_DV_TRANSPORTE", f.dvTransporte);
    if (f.patente) await this.p.fill("#EFXP_PATENTE", f.patente);
    if (f.rutChofer) await this.p.fill("#EFXP_RUT_CHOFER", f.rutChofer);
    if (f.dvChofer) await this.p.fill("#EFXP_DV_CHOFER", f.dvChofer);
    if (f.nombreChofer) await this.p.fill("#EFXP_NOMBRE_CHOFER", f.nombreChofer);
  }

  private async agregarLineaDetalle(): Promise<void> {
    const clickeado = await this.p.evaluate(() => {
      const btn = document.querySelector('input[name="AGREGA_DETALLE"]') as HTMLInputElement | null;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clickeado) {
      const diagnostico = await this.capturarDiagnostico("agregar_linea_no_encontrado");
      throw new Error(`No se encontró el botón "Agrega línea de Detalle". Diagnóstico: ${diagnostico}`);
    }
    await sleep(300);
  }

  private async fillItems(items: FacturaItemInput[]): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      if (i > 0) await this.agregarLineaDetalle();
      const n = String(i + 1).padStart(2, "0");
      const item = items[i];
      await this.p.fill(`input[name=EFXP_NMB_${n}]`, item.nombre);
      await this.p.fill(`input[name=EFXP_QTY_${n}]`, String(item.cantidad));
      if (item.unidad) await this.p.fill(`input[name=EFXP_UNMD_${n}]`, item.unidad);
      await this.p.fill(`input[name=EFXP_PRC_${n}]`, String(item.precio));
      if (item.pctDescuento) await this.p.fill(`input[name=EFXP_PCTD_${n}]`, String(item.pctDescuento));
    }
  }

  private async fillPagoYDescuento(f: FacturaInput): Promise<void> {
    await this.p.selectOption("select[name=EFXP_FMA_PAGO]", VALUE_FORMA_PAGO[f.formaPago]);
    if (f.pctDescuentoGlobal) {
      await this.p.fill("input[name=EFXP_PCT_DESC]", String(f.pctDescuentoGlobal));
    }
  }

  // ADVERTENCIA: la exploración del portal se detuvo deliberadamente antes de
  // hacer clic en "Validar y visualizar" y en el botón de confirmación final,
  // para no emitir por accidente un documento tributario real e irreversible.
  // Estos selectores son la mejor aproximación posible sin verificación en
  // vivo — antes de usar en producción, correr una factura de prueba
  // controlada (monto mínimo) con el usuario mirando cada pantalla y ajustar
  // lo que no calce.
  private async emitirFactura(f: FacturaInput): Promise<{ folio: string | null; pdfPath: string }> {
    await this.fillReceptor(f);
    await this.fillTransporte(f);
    await this.fillItems(f.items);
    await this.fillPagoYDescuento(f);

    const validarClickeado = await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, input[type=submit], input[type=button]"));
      const btn = buttons.find((b) =>
        ((b as HTMLElement).innerText || (b as HTMLInputElement).value || "").trim().toUpperCase().includes("VALIDAR"),
      );
      if (btn) {
        (btn as HTMLElement).click();
        return true;
      }
      return false;
    });
    if (!validarClickeado) {
      const diagnostico = await this.capturarDiagnostico("validar_no_encontrado");
      throw new Error(`No se encontró el botón "Validar y visualizar". Diagnóstico: ${diagnostico}`);
    }
    await this.p.waitForLoadState("networkidle").catch(() => {});
    await sleep(1500);

    const confirmado = await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, input[type=submit], input[type=button]"));
      const btn = buttons.find((b) =>
        ((b as HTMLElement).innerText || (b as HTMLInputElement).value || "").trim().toUpperCase().includes("EMITIR"),
      );
      if (btn) {
        (btn as HTMLElement).click();
        return true;
      }
      return false;
    });
    if (!confirmado) {
      const diagnostico = await this.capturarDiagnostico("confirmar_emision_no_encontrado");
      throw new Error(
        `No se encontró el botón de confirmación tras "Validar y visualizar". Diagnóstico: ${diagnostico}`,
      );
    }
    await this.p.waitForLoadState("networkidle").catch(() => {});
    await sleep(4000);

    const folio = await this.p.evaluate(() => {
      const texto = document.body?.innerText ?? "";
      const match = texto.match(/FOLIO\s*N?°?\s*:?\s*(\d+)/i) ?? texto.match(/N[ºUMERO\s:°]+\s*(\d+)/i);
      return match ? match[1] : null;
    });

    const href = await this.p.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const link = links.find(
        (a) => a.innerText.toUpperCase().includes("PDF") || a.innerText.toUpperCase().includes("DESCARGAR"),
      );
      return (link as HTMLAnchorElement | undefined)?.href ?? null;
    });
    if (!href) {
      const diagnostico = await this.capturarDiagnostico("descarga_pdf_no_encontrada");
      throw new Error(
        `La factura pudo haberse emitido en el SII pero no se encontró el link de descarga del PDF. Diagnóstico: ${diagnostico}`,
      );
    }

    const respuesta = await fetch(href);
    if (!respuesta.ok) {
      throw new Error(
        `La factura pudo haberse emitido en el SII pero la descarga del PDF falló con status ${respuesta.status} en ${href}`,
      );
    }

    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}`;
    const sufijo = folio ?? `${String(hoy.getHours()).padStart(2, "0")}${String(hoy.getMinutes()).padStart(2, "0")}${String(hoy.getSeconds()).padStart(2, "0")}`;
    const destino = `${this.descargasDir}/factura_${fecha}_${sufijo}.pdf`;
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    await writeFile(destino, buffer);

    return { folio, pdfPath: destino };
  }

  async runBatchSimulado(facturas: FacturaInput[]): Promise<FacturaResultado[]> {
    const fs = await import("node:fs/promises");
    const pdfFalso = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>",
    );

    const resultados: FacturaResultado[] = [];
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      await sleep(500);
      if (i % 3 === 2) {
        resultados.push({
          facturaRef: factura.facturaRef,
          exito: false,
          error: "Simulación: error de prueba (timeout esperando botón EMITIR)",
        });
        continue;
      }
      const destino = `${this.descargasDir}/sim_factura_${factura.facturaRef.replace(/\s+/g, "_")}.pdf`;
      await fs.writeFile(destino, pdfFalso);
      resultados.push({ facturaRef: factura.facturaRef, exito: true, folio: `SIM-${i + 1}`, pdfPath: destino });
    }
    return resultados;
  }

  async runBatch(razonSocialEmisor: string, facturas: FacturaInput[]): Promise<FacturaResultado[]> {
    await this.start();
    try {
      await this.login();
      await this.seleccionarEmpresa(razonSocialEmisor);
      await this.validarRazonSocialEmisor(razonSocialEmisor);

      const resultados: FacturaResultado[] = [];
      for (let i = 0; i < facturas.length; i++) {
        const factura = facturas[i];
        try {
          if (i > 0) {
            await this.p.goto(GENERAR_URL);
            await this.p.waitForLoadState("networkidle");
            await this.validarRazonSocialEmisor(razonSocialEmisor);
          }
          const { folio, pdfPath } = await this.emitirFactura(factura);
          resultados.push({ facturaRef: factura.facturaRef, exito: true, folio: folio ?? undefined, pdfPath });
        } catch (err) {
          resultados.push({
            facturaRef: factura.facturaRef,
            exito: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return resultados;
    } finally {
      await this.stop();
    }
  }
}
