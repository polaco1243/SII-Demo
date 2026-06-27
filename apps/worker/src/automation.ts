import { chromium, type Browser, type Page } from "playwright";

const SII_URL = "https://eboleta.sii.cl/emitir/";

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BoletaInput {
  nombre: string;
  monto: number;
  detalle: string;
  email?: string | null;
}

export interface BoletaResultado {
  nombre: string;
  exito: boolean;
  pdfPath?: string;
  error?: string;
}

export class SIIAutomation {
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
      viewport: { width: 1366, height: 768 },
      locale: "es-CL",
      timezoneId: "America/Santiago",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    await this.page.goto(SII_URL);
    await this.page.waitForLoadState("networkidle");
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
    const screenshotPath = `${this.descargasDir}/debug_${etiqueta}_${timestamp}.png`;
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

  private async ingresarCredenciales(): Promise<void> {
    try {
      await this.p.waitForSelector("#inputRut", { state: "visible", timeout: 20000 });
    } catch (err) {
      const diagnostico = await this.capturarDiagnostico("login_no_aparecio");
      throw new Error(`No apareció el formulario de login del SII. Diagnóstico: ${diagnostico}`);
    }
    await this.p.fill("#inputRut", this.rut);
    await this.p.fill("#inputPass", this.clave);
    await this.p.click("#bt_ingresar");
    await this.p.waitForLoadState("networkidle");
    await sleep(1000);
  }

  private async abrirSelectorEmisorYListar(): Promise<string[]> {
    await this.p.locator(".v-select").first().click();
    await sleep(500);
    const opciones = await this.p.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.v-select-list .v-list-item, [role="listbox"] [role="option"]'));
      return items.map((item) => (item.textContent ?? "").trim()).filter(Boolean);
    });
    return Array.from(new Set(opciones));
  }

  private async seleccionarEmisor(emisorExacto: string): Promise<void> {
    await this.p.click(`text=${emisorExacto}`);
    await sleep(1000);
  }

  async login(emisor: string): Promise<void> {
    await this.ingresarCredenciales();
    await this.abrirSelectorEmisorYListar();
    await this.seleccionarEmisor(emisor);
  }

  async descubrirEmisores(): Promise<string[]> {
    await this.start();
    try {
      await this.ingresarCredenciales();
      return await this.abrirSelectorEmisorYListar();
    } finally {
      await this.stop();
    }
  }

  private async clickEmitirInicial(): Promise<void> {
    await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find(
        (b) => b.innerText.trim() === "Emitir" && b.classList.contains("success"),
      );
      btn?.click();
    });
    await sleep(1000);
  }

  private async toggleDetalle(): Promise<void> {
    const toggled = await this.p.evaluate(() => {
      const switches = Array.from(document.querySelectorAll(".v-input--switch"));
      const sw = switches.find((s) => (s as HTMLElement).innerText.includes("Detalle"));
      const track = sw?.querySelector(".v-input--switch__track");
      if (track) {
        (track as HTMLElement).click();
        return true;
      }
      return false;
    });
    if (!toggled) {
      await this.p.locator("input[type=checkbox]").first().click({ timeout: 30000 });
    }
    await sleep(300);
  }

  private async fillDetalle(detalle: string): Promise<void> {
    const detalleEscaped = escape(detalle);
    await this.p.evaluate((value) => {
      const inputs = document.querySelectorAll(".v-text-field input");
      for (const input of Array.from(inputs)) {
        const label = input.closest(".v-text-field")?.querySelector(".v-label");
        if (label && label.textContent?.includes("Detalle")) {
          (input as HTMLInputElement).value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          break;
        }
      }
    }, detalleEscaped);
    await sleep(300);
  }

  private async ingresarMonto(monto: number): Promise<void> {
    for (const digito of String(Math.trunc(monto))) {
      await this.p.evaluate((d) => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const btn = buttons.find((b) => b.innerText.trim() === d);
        btn?.click();
      }, digito);
      await sleep(300);
    }
  }

  private async clickEmitirFinal(): Promise<void> {
    await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find(
        (b) =>
          (b.innerText.trim() === "EMITIR" || b.innerText.trim() === "Emitir") &&
          b.classList.contains("success") &&
          !(b as HTMLButtonElement).disabled,
      );
      btn?.click();
    });
    await sleep(9000);
  }

  private async descargarPdf(nombreArchivo: string): Promise<string> {
    const [download] = await Promise.all([
      this.p.waitForEvent("download"),
      this.p.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const link = links.find(
          (a) => a.innerText.includes("Descargar") && !a.classList.contains("disabled"),
        );
        (link as HTMLElement | undefined)?.click();
      }),
    ]);
    const destino = `${this.descargasDir}/${nombreArchivo}`;
    await download.saveAs(destino);
    return destino;
  }

  private async enviarEmail(email: string): Promise<void> {
    const emailEscaped = escape(email);
    await this.p.evaluate((value) => {
      const inputs = document.querySelectorAll(".v-text-field input");
      for (const input of Array.from(inputs)) {
        const label = input.closest(".v-text-field")?.querySelector(".v-label");
        if (label && label.textContent?.includes("E-mail")) {
          (input as HTMLInputElement).value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          break;
        }
      }
    }, emailEscaped);
    await sleep(300);
    await this.p.evaluate(() => {
      const icon = document.querySelector("button i.mdi-send");
      icon?.closest("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await sleep(1000);
  }

  private async cerrarDialogo(): Promise<void> {
    await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => ["Cerrar", "CERRAR"].includes(b.innerText.trim()));
      btn?.click();
    });
    await sleep(500);
  }

  async emitirBoleta(boleta: BoletaInput): Promise<string> {
    await this.clickEmitirInicial();
    await this.toggleDetalle();
    await this.fillDetalle(boleta.detalle);
    await this.ingresarMonto(boleta.monto);
    await this.clickEmitirFinal();

    const nombreArchivo = `boleta_${boleta.nombre.replace(/\s+/g, "_")}.pdf`;
    const destino = await this.descargarPdf(nombreArchivo);

    if (boleta.email) {
      await this.enviarEmail(boleta.email);
    }

    await this.cerrarDialogo();
    return destino;
  }

  async runBatch(emisor: string, boletas: BoletaInput[]): Promise<BoletaResultado[]> {
    await this.start();
    try {
      await this.login(emisor);
      const resultados: BoletaResultado[] = [];
      for (const boleta of boletas) {
        try {
          const pdfPath = await this.emitirBoleta(boleta);
          resultados.push({ nombre: boleta.nombre, exito: true, pdfPath });
        } catch (err) {
          resultados.push({
            nombre: boleta.nombre,
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
