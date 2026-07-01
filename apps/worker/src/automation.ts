import { chromium, type Browser, type Page } from "playwright";
import { writeFile } from "node:fs/promises";

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
  tipoBoleta: "exenta" | "afecta";
  metodoPago: "debito" | "credito" | "efectivo" | "otro" | "transferencia";
  conReceptor: boolean;
  receptorRut?: string | null;
  receptorNombre?: string | null;
  receptorDireccion?: string | null;
  receptorEmail?: string | null;
  receptorTelefono?: string | null;
  conDetalle: boolean;
  detalle?: string | null;
  email?: string | null;
}

const TEXTO_TIPO_BOLETA: Record<BoletaInput["tipoBoleta"], string> = {
  exenta: "Boleta exenta",
  afecta: "Boleta afecta",
};

const TEXTO_METODO_PAGO: Record<BoletaInput["metodoPago"], string> = {
  debito: "Débito",
  credito: "Crédito",
  efectivo: "Efectivo",
  otro: "Otro",
  transferencia: "Transferencia",
};

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

  // Modo exploración: mapea la estructura real de la pantalla de emisión del
  // SII (calculadora de monto + EMITIR) para descubrir dónde están las
  // opciones de tipo de boleta, método de pago, receptor y detalle.
  // Vuelca screenshots + HTML a /data/descargas para inspección manual.
  async explorarEmision(): Promise<string[]> {
    const ts = Date.now();
    const capturados: string[] = [];
    const capturar = async (etiqueta: string) => {
      const png = `explor_${etiqueta}_${ts}.png`;
      const html = `explor_${etiqueta}_${ts}.html`;
      await this.p.screenshot({ path: `${this.descargasDir}/${png}`, fullPage: true }).catch(() => {});
      await writeFile(`${this.descargasDir}/${html}`, await this.p.content()).catch(() => {});
      capturados.push(png, html);
    };

    // 1. Pantalla inicial (monto = 0)
    await capturar("01_inicial");

    // 2. Ingresar un monto de prueba
    for (const d of "1000") {
      await this.p.evaluate((digito) => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.innerText.trim() === digito,
        );
        btn?.click();
      }, d);
      await sleep(200);
    }
    await capturar("02_con_monto");

    // 3. Click en EMITIR (mayúsculas, tal como aparece en el portal real)
    await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.trim() === "EMITIR");
      btn?.click();
    });
    await sleep(1500);
    await capturar("03_post_emitir");

    // 4. Si se abrió un dialog/modal (Vuetify), capturar también solo su HTML
    const hayDialog = await this.p.evaluate(
      () => !!document.querySelector(".v-dialog--active, .v-overlay--active"),
    );
    if (hayDialog) {
      await capturar("04_dialog");

      // 5. Activar switches Receptor y Detalle dentro del modal para ver
      //    labels reales de los campos condicionales (RUT/Nombre/Dirección
      //    receptor pueden autocompletarse y no mostrar label visible).
      await this.p.evaluate(() => {
        const switches = Array.from(document.querySelectorAll(".v-input--switch"));
        for (const sw of switches) {
          const track = sw.querySelector(".v-input--switch__track");
          (track as HTMLElement | null)?.click();
        }
      });
      await sleep(800);
      await capturar("05_switches_activos");

      // 6. Escribir un RUT de prueba en el campo de receptor para ver si
      //    autocompleta Nombre/Dirección
      await this.p.evaluate(() => {
        const inputs = document.querySelectorAll(".v-text-field input");
        for (const input of Array.from(inputs)) {
          const lbl = input.closest(".v-text-field")?.querySelector(".v-label");
          if (lbl && lbl.textContent?.includes("RUT")) {
            (input as HTMLInputElement).value = "11111111-1";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            break;
          }
        }
      });
      await sleep(1500);
      await capturar("06_rut_receptor_ingresado");
    }

    return capturados;
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

  // La pantalla principal es una calculadora de monto. Al presionar EMITIR
  // (mayúsculas) con monto > 0 se abre un modal "Emitir e-Boleta" que
  // contiene los controles reales (tipo de boleta, método de pago,
  // receptor, detalle). Este método ingresa el monto y espera el modal.
  private async clickEmitirInicial(): Promise<void> {
    const clickeado = await this.p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.trim() === "EMITIR" && b.classList.contains("success"));
      if (btn && !(btn as HTMLButtonElement).disabled) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clickeado) {
      const diagnostico = await this.capturarDiagnostico("emitir_inicial_no_encontrado");
      throw new Error(`No se encontró el botón EMITIR inicial. Diagnóstico: ${diagnostico}`);
    }
    try {
      await this.p.waitForSelector(".v-dialog--active", { state: "visible", timeout: 10000 });
    } catch {
      const diagnostico = await this.capturarDiagnostico("modal_emitir_no_aparecio");
      throw new Error(`No apareció el modal "Emitir e-Boleta". Diagnóstico: ${diagnostico}`);
    }
    await sleep(500);
  }

  private async toggleSwitchPorTexto(texto: string): Promise<void> {
    const toggled = await this.p.evaluate((t) => {
      const switches = Array.from(document.querySelectorAll(".v-input--switch"));
      const sw = switches.find((s) => (s as HTMLElement).innerText.includes(t));
      const track = sw?.querySelector(".v-input--switch__track");
      if (track) {
        (track as HTMLElement).click();
        return true;
      }
      return false;
    }, texto);
    if (!toggled) {
      const diagnostico = await this.capturarDiagnostico(`switch_${texto}_no_encontrado`);
      throw new Error(`No se encontró el switch "${texto}". Diagnóstico: ${diagnostico}`);
    }
    await sleep(300);
  }

  private async fillCampoPorLabel(labelTexto: string, valor: string): Promise<void> {
    const encontrado = await this.p.evaluate(
      ({ label, value }) => {
        const inputs = document.querySelectorAll(".v-text-field input");
        for (const input of Array.from(inputs)) {
          const lbl = input.closest(".v-text-field")?.querySelector(".v-label");
          if (lbl && lbl.textContent?.includes(label)) {
            (input as HTMLInputElement).value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            return true;
          }
        }
        return false;
      },
      { label: labelTexto, value: valor },
    );
    if (!encontrado) {
      const diagnostico = await this.capturarDiagnostico(`campo_${labelTexto}_no_encontrado`);
      throw new Error(`No se encontró el campo "${labelTexto}". Diagnóstico: ${diagnostico}`);
    }
    await sleep(200);
  }

  private async seleccionarEnDropdownPorAncla(textoAncla: string, opcionExacta: string): Promise<void> {
    const abierto = await this.p.evaluate((ancla) => {
      const selects = Array.from(document.querySelectorAll(".v-select"));
      const target = selects.find((s) => (s as HTMLElement).innerText.includes(ancla));
      const boton = target?.querySelector('[role="button"]');
      if (boton) {
        (boton as HTMLElement).click();
        return true;
      }
      return false;
    }, textoAncla);
    if (!abierto) {
      const diagnostico = await this.capturarDiagnostico(`dropdown_${textoAncla}_no_encontrado`);
      throw new Error(`No se encontró el selector "${textoAncla}". Diagnóstico: ${diagnostico}`);
    }
    await sleep(500);
    await this.p.click(`text=${opcionExacta}`);
    await sleep(500);
  }

  // El dropdown de tipo de boleta a veces viene bloqueado (v-input--is-disabled)
  // porque el emisor solo tiene habilitado un tipo según su actividad económica.
  // En ese caso no se puede cambiar: solo se valida que coincida con lo pedido.
  private async verificarOSeleccionarTipoBoleta(tipo: BoletaInput["tipoBoleta"]): Promise<void> {
    const estado = await this.p.evaluate(() => {
      const selects = Array.from(document.querySelectorAll(".v-select"));
      const target = selects.find((s) => (s as HTMLElement).innerText.includes("Boleta"));
      if (!target) return { encontrado: false, disabled: false, texto: "" };
      return {
        encontrado: true,
        disabled: target.classList.contains("v-input--is-disabled"),
        texto: (target as HTMLElement).innerText.trim(),
      };
    });

    if (!estado.encontrado) {
      const diagnostico = await this.capturarDiagnostico("tipo_boleta_no_encontrado");
      throw new Error(`No se encontró el selector de tipo de boleta. Diagnóstico: ${diagnostico}`);
    }

    if (estado.disabled) {
      if (!estado.texto.includes(TEXTO_TIPO_BOLETA[tipo])) {
        throw new Error(
          `El emisor solo permite "${estado.texto}" en el portal SII, pero el CSV pide "${TEXTO_TIPO_BOLETA[tipo]}"`,
        );
      }
      return;
    }

    await this.seleccionarEnDropdownPorAncla("Boleta", TEXTO_TIPO_BOLETA[tipo]);
  }

  private async seleccionarMetodoPago(metodo: BoletaInput["metodoPago"]): Promise<void> {
    await this.seleccionarEnDropdownPorAncla("método de pago", TEXTO_METODO_PAGO[metodo]);
  }

  private async llenarReceptor(boleta: BoletaInput): Promise<void> {
    await this.toggleSwitchPorTexto("Receptor");
    await this.fillCampoPorLabel("RUT", boleta.receptorRut ?? "");
    await this.fillCampoPorLabel("Nombre", boleta.receptorNombre ?? "");
    await this.fillCampoPorLabel("Dirección", boleta.receptorDireccion ?? "");
    await this.fillCampoPorLabel("E-mail", boleta.receptorEmail ?? "");
    await this.fillCampoPorLabel("Teléfono", boleta.receptorTelefono ?? "");
  }

  private async toggleDetalle(): Promise<void> {
    await this.toggleSwitchPorTexto("Detalle");
  }

  private async fillDetalle(detalle: string): Promise<void> {
    await this.fillCampoPorLabel("Detalle", detalle);
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

  // Botón EMITIR de confirmación dentro del modal (distinto del EMITIR
  // inicial de la pantalla principal, que ya no está visible en este punto).
  private async clickEmitirFinal(): Promise<void> {
    const clickeado = await this.p.evaluate(() => {
      const dialog = document.querySelector(".v-dialog--active");
      if (!dialog) return false;
      const buttons = Array.from(dialog.querySelectorAll("button"));
      const btn = buttons.find(
        (b) => b.innerText.trim().toUpperCase() === "EMITIR" && !(b as HTMLButtonElement).disabled,
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clickeado) {
      const diagnostico = await this.capturarDiagnostico("emitir_final_no_encontrado");
      throw new Error(`No se encontró el botón EMITIR de confirmación. Diagnóstico: ${diagnostico}`);
    }
    await sleep(9000);
  }

  private async descargarPdf(nombreArchivo: string): Promise<string> {
    let download;
    try {
      [download] = await Promise.all([
        this.p.waitForEvent("download", { timeout: 15000 }),
        this.p.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a"));
          const link = links.find(
            (a) => a.innerText.includes("Descargar") && !a.classList.contains("disabled"),
          );
          (link as HTMLElement | undefined)?.click();
        }),
      ]);
    } catch {
      // La boleta probablemente YA se emitió en el SII (el click en EMITIR
      // ya se ejecutó antes de llegar aquí); este fallo es solo de la
      // descarga del PDF. Se listan todos los links/botones visibles para
      // encontrar el selector correcto sin necesitar otra ronda de captura.
      const diagnostico = await this.capturarDiagnostico("descarga_pdf_no_encontrada");
      const candidatos = await this.p.evaluate(() => {
        const elementos = Array.from(document.querySelectorAll("a, button"));
        return elementos
          .map((el) => {
            const texto = (el as HTMLElement).innerText?.trim().replace(/\s+/g, " ") ?? "";
            const iconos = Array.from(el.querySelectorAll("i")).map((i) => i.className).join(",");
            return { tag: el.tagName.toLowerCase(), texto, iconos, href: (el as HTMLAnchorElement).href ?? "" };
          })
          .filter((e) => e.texto || e.iconos);
      });
      throw new Error(
        `La boleta se emitió en el SII pero no se pudo descargar el PDF automáticamente. Diagnóstico: ${diagnostico} | Elementos visibles: ${JSON.stringify(candidatos)}`,
      );
    }
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
    await this.ingresarMonto(boleta.monto);
    await this.clickEmitirInicial();
    await this.verificarOSeleccionarTipoBoleta(boleta.tipoBoleta);
    await this.seleccionarMetodoPago(boleta.metodoPago);

    if (boleta.conReceptor) {
      await this.llenarReceptor(boleta);
    }

    if (boleta.conDetalle && boleta.detalle) {
      await this.toggleDetalle();
      await this.fillDetalle(boleta.detalle);
    }

    await this.clickEmitirFinal();

    const nombreArchivo = `boleta_${boleta.nombre.replace(/\s+/g, "_")}.pdf`;
    const destino = await this.descargarPdf(nombreArchivo);

    if (boleta.email) {
      await this.enviarEmail(boleta.email);
    }

    await this.cerrarDialogo();
    return destino;
  }

  async runBatchSimulado(boletas: BoletaInput[]): Promise<BoletaResultado[]> {
    const fs = await import("node:fs/promises");
    const pdfFalso = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>",
    );

    const resultados: BoletaResultado[] = [];
    for (let i = 0; i < boletas.length; i++) {
      const boleta = boletas[i];
      await sleep(500);
      if (i % 3 === 2) {
        resultados.push({
          nombre: boleta.nombre,
          exito: false,
          error: "Simulación: error de prueba (timeout esperando botón EMITIR)",
        });
        continue;
      }
      const destino = `${this.descargasDir}/sim_${boleta.nombre.replace(/\s+/g, "_")}.pdf`;
      await fs.writeFile(destino, pdfFalso);
      resultados.push({ nombre: boleta.nombre, exito: true, pdfPath: destino });
    }
    return resultados;
  }

  async runBatch(emisor: string, boletas: BoletaInput[]): Promise<BoletaResultado[]> {
    await this.start();
    try {
      await this.login(emisor);

      // Modo exploración: captura la estructura del portal y falla a propósito
      // sin emitir boletas reales. Se activa con EXPLORAR_SII=true.
      if (process.env.EXPLORAR_SII === "true") {
        const capturados = await this.explorarEmision();
        return boletas.map((b) => ({
          nombre: b.nombre,
          exito: false,
          error: `Modo exploración activo. Artefactos: ${capturados.join(", ")}`,
        }));
      }

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
