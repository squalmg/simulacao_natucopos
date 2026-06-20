const logoProbe = new Image();
logoProbe.onload = () => {
  const logo = document.getElementById("brandLogo");
  if (logo) logo.src = "/logo.svg";
};
logoProbe.src = "/logo.svg";

const STORAGE_KEY = "natucopos_visual_simulation_v2";
const WHATSAPP = "5564999480738";
const IMAGE_WEBHOOK_URL = "https://automacao.clanmarketing.com.br/webhook/natucopos/simulador/gerar-imagens";

let currentStep = 1;
const totalSteps = 6;

const choices = {
  segment: ["Açaíteria", "Sorveteria", "Gelateria", "Cafeteria", "Doceria", "Bolo no pote", "Restaurante / delivery", "Outro"],
  package_type: ["Pote de papel", "Copo de papel", "Bowl", "Combo com mais de uma embalagem"],
  package_size: ["120 ml", "240 ml", "250 ml", "360 ml", "500 ml", "750 ml", "1000 ml"],
  visual_style: ["Premium tropical", "Moderno e limpo", "Divertido e colorido", "Minimalista", "Luxo", "Natural/sustentável", "Fitness", "Infantil/divertido"],
};

const directions = {
  premium: {
    title: "Opção Premium",
    short: "Premium",
    className: "premium-style",
    description: "Visual mais sofisticado, ideal para marca com posicionamento superior.",
    focus: "usar linguagem premium, composição elegante, poucos elementos, contraste forte, logo em destaque e visual de marca valorizada.",
  },
  colorida: {
    title: "Opção Colorida",
    short: "Colorida",
    className: "colorful-style",
    description: "Visual mais chamativo, ideal para açaí, sorvete, delivery e redes sociais.",
    focus: "mais energia visual, frutas, ondas, formas orgânicas, maior presença de cores, comercial e chamativo, sem poluir.",
  },
  clean: {
    title: "Opção Clean",
    short: "Clean",
    className: "clean-style",
    description: "Visual mais limpo, moderno e fácil de aplicar em diferentes embalagens.",
    focus: "minimalista, fundo claro ou cor sólida, logo central, poucos elementos, elegante e fácil de produzir.",
  },
};

const state = {
  segment: "Açaíteria",
  package_type: "Pote de papel",
  package_size: "750 ml",
  visual_style: "Premium tropical",
  prompts: {},
  selected_direction: "",
  requested_adjustment: "",
  generated_images: {
    premium: "",
    colorida: "",
    clean: "",
  },
};

const form = document.getElementById("simulationForm");

function $(id) {
  return document.getElementById(id);
}

function safeElement(name) {
  return form?.elements?.[name] || null;
}

function safeValue(name, fallback = "") {
  const el = safeElement(name);
  if (!el) return fallback;
  if (el.type === "checkbox") return el.checked;
  return typeof el.value === "string" ? el.value : fallback;
}

function safeFileName(name) {
  const el = safeElement(name);
  return el?.files?.[0]?.name || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initChoices() {
  document.querySelectorAll("[data-name]").forEach((box) => {
    const name = box.dataset.name;
    if (!choices[name]) return;

    box.innerHTML = "";

    choices[name].forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = (name === "package_size" ? "chip" : "option") + (state[name] === v ? " selected" : "");
      b.textContent = v;

      b.onclick = () => {
        state[name] = v;
        box.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        save();
        updateMainPreview();
      };

      box.appendChild(b);
    });
  });
}

function formData() {
  const d = form ? Object.fromEntries(new FormData(form).entries()) : {};

  Object.assign(d, state);

  const logoFileName = safeFileName("logo_file");
  const noLogo = !!safeValue("no_logo", false);

  d.logo_file_name = logoFileName || d.logo_file_name || "";
  d.has_logo = !!logoFileName && !noLogo;
  d.wants_qr_code = d.wants_qr_code || "Não";

  return d;
}

function utms() {
  const p = new URLSearchParams(location.search);
  return {
    utm_source: p.get("utm_source") || "",
    utm_campaign: p.get("utm_campaign") || "",
    utm_medium: p.get("utm_medium") || "",
    utm_content: p.get("utm_content") || "",
    utm_term: p.get("utm_term") || "",
  };
}

function fixedRules() {
  return [
    "não criar mockup 3D",
    "criar arte plana frontal 1:1",
    "não inventar marca",
    "não copiar textos de imagens de referência",
    "não criar tampa",
    "não alterar formato real da embalagem",
    "não escrever textos pequenos ilegíveis",
    "reservar área limpa para logo",
    "usar somente dados enviados pelo cliente",
  ];
}

function makePrompt(d, key = "base") {
  const dir = directions[key];
  const focus = dir ? dir.focus : `respeitar o estilo solicitado: ${d.visual_style || ""}.`;

  return `Crie uma arte plana frontal 1:1 para embalagem personalizada Natucopos.

Direção visual: ${dir ? dir.title : d.visual_style || "Briefing técnico"}
Objetivo: ${focus}
Marca informada pelo cliente: ${d.company_name || ""}
Segmento: ${d.segment || ""}
Produto: ${d.product_description || ""}
Embalagem real: ${d.package_type || ""} ${d.package_size || ""}
Cores enviadas: principal ${d.primary_color || ""}, secundária ${d.secondary_color || ""}, apoio ${d.support_color || ""}
Frase principal: ${d.main_phrase || ""}
Frase secundária: ${d.secondary_phrase || ""}
Instagram: ${d.package_instagram || d.instagram || ""}
WhatsApp/telefone: ${d.package_phone || ""}
Observações do cliente: ${d.observations || ""}
Logo: ${d.has_logo ? "cliente enviou arquivo " + d.logo_file_name : "cliente não enviou logo; reservar área limpa para aplicação posterior"}

Regras fixas obrigatórias:
- ${fixedRules().join("\n- ")}

Resultado esperado: composição comercial profissional, aplicável na frente da embalagem, com leitura clara e sem elementos que dificultem produção.`;
}

function buildPrompts() {
  const d = formData();
  state.prompts = {
    premium: makePrompt(d, "premium"),
    colorida: makePrompt(d, "colorida"),
    clean: makePrompt(d, "clean"),
  };
  return state.prompts;
}

function visualSimulationPayload() {
  const d = formData();

  if (!state.simulation_id) state.simulation_id = `NATU-${Date.now()}`;
  if (!state.created_at) state.created_at = new Date().toISOString();

  return {
    simulation_id: state.simulation_id,
    created_at: state.created_at,
    source: "simulador_natucopos_v2",
    utms: utms(),
    customer: {
      name: d.customer_name || "",
      whatsapp: d.whatsapp || "",
      city_state: d.city_state || "",
      instagram: d.instagram || "",
    },
    package: {
      type: d.package_type || "",
      size: d.package_size || "",
    },
    brand: {
      name: d.company_name || "",
      main_phrase: d.main_phrase || "",
      secondary_phrase: d.secondary_phrase || "",
      package_instagram: d.package_instagram || "",
      package_phone: d.package_phone || "",
      colors: {
        primary: d.primary_color || "",
        secondary: d.secondary_color || "",
        support: d.support_color || "",
      },
    },
    briefing: {
      segment: d.segment || "",
      product_description: d.product_description || "",
      visual_style: d.visual_style || "",
      observations: d.observations || "",
      wants_qr_code: d.wants_qr_code === "Sim",
      qr_code_url: d.qr_code_url || "",
    },
    prompts: state.prompts,
    selected_direction: state.selected_direction,
    requested_adjustment: state.requested_adjustment,
    logo_file_name: d.logo_file_name || "",
    generated_images: state.generated_images,
    status: state.selected_direction ? "visual_direction_selected" : "visual_options_generated",
  };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...formData(), ...state }));
  } catch (e) {
    console.warn("Não foi possível salvar localmente.", e);
  }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    Object.assign(state, {
      segment: s.segment || state.segment,
      package_type: s.package_type || state.package_type,
      package_size: s.package_size || state.package_size,
      visual_style: s.visual_style || state.visual_style,
      prompts: s.prompts || {},
      selected_direction: s.selected_direction || "",
      requested_adjustment: s.requested_adjustment || "",
      simulation_id: s.simulation_id,
      created_at: s.created_at,
      generated_images: s.generated_images || state.generated_images,
    });

    Object.entries(s).forEach(([k, v]) => {
      const el = safeElement(k);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.type !== "file") el.value = v;
    });
  } catch (e) {
    console.warn("Não foi possível carregar dados locais.", e);
  }
}

function validate() {
  if (currentStep !== 1) return true;

  let ok = true;

  ["customer_name", "whatsapp", "company_name"].forEach((n) => {
    const el = safeElement(n);
    if (!el) return;

    const empty = !String(el.value || "").trim();
    el.classList.toggle("error", empty);

    if (empty) ok = false;
  });

  return ok;
}

function showStep(n) {
  currentStep = Math.max(1, Math.min(totalSteps, n));

  document.querySelectorAll(".step").forEach((s) => {
    s.classList.toggle("active", Number(s.dataset.step) === currentStep);
  });

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const formActions = document.querySelector(".form-actions");
  const stepLabel = $("stepLabel");
  const progressPercent = $("progressPercent");
  const progressBar = $("progressBar");

  if (prevBtn) prevBtn.style.display = currentStep === 1 ? "none" : "inline-flex";
  if (nextBtn) nextBtn.textContent = currentStep === 5 ? "Finalizar briefing" : "Continuar";
  if (formActions) formActions.style.display = currentStep === 6 ? "none" : "flex";

  const pct = Math.round((currentStep / totalSteps) * 100);

  if (stepLabel) stepLabel.textContent = `Etapa ${currentStep} de ${totalSteps}`;
  if (progressPercent) progressPercent.textContent = `${pct}%`;
  if (progressBar) progressBar.style.width = `${pct}%`;

  if (currentStep === 6) renderResult();

  save();
}

function renderResult() {
  buildPrompts();

  const p = visualSimulationPayload();
  window.visualSimulationPayload = p;

  const summary = $("summary");
  const generatedPrompt = $("generatedPrompt");
  const simulationOptions = $("simulationOptions");

  if (summary) {
    summary.innerHTML = `
      <div><b>Cliente:</b> ${escapeHtml(p.customer.name)} • ${escapeHtml(p.customer.whatsapp)}</div>
      <div><b>Marca:</b> ${escapeHtml(p.brand.name)} • ${escapeHtml(p.customer.city_state)}</div>
      <div><b>Embalagem:</b> ${escapeHtml(p.package.type)} ${escapeHtml(p.package.size)}</div>
      <div><b>Estilo inicial:</b> ${escapeHtml(p.briefing.visual_style)}</div>
      <div><b>Cores:</b> ${escapeHtml(p.brand.colors.primary)}, ${escapeHtml(p.brand.colors.secondary)}, ${escapeHtml(p.brand.colors.support)}</div>
      <div><b>Textos:</b> ${escapeHtml(p.brand.main_phrase)} ${escapeHtml(p.brand.secondary_phrase)}</div>
      <div><b>Logo:</b> ${escapeHtml(p.logo_file_name || "Sem arquivo enviado")}</div>
    `;
  }

  if (generatedPrompt) {
    generatedPrompt.textContent = makePrompt(formData(), "base");
  }

  updateMainPreview();

  if (simulationOptions && !simulationOptions.hidden) {
    renderOptions();
  }

  updateChosen();
  save();
}

function mockupHtml(key) {
  const d = formData();
  const dir = directions[key] || directions.premium;
  const image = state.generated_images?.[key];

  if (image) {
    return `
      <div class="visual-mockup ${dir.className}" data-visual="${key}">
        <img src="${escapeHtml(image)}" alt="Simulação ${escapeHtml(dir.short)}" style="width:100%;height:100%;object-fit:cover;border-radius:24px;display:block;">
      </div>
    `;
  }

  return `
    <div class="visual-mockup ${dir.className}" data-visual="${key}" style="--primary:${escapeHtml(d.primary_color || "#0f7a3b")};--secondary:${escapeHtml(d.secondary_color || "#f3c96b")};--support:${escapeHtml(d.support_color || "#ffffff")}">
      <div class="mock-shape">
        <strong>${escapeHtml(d.company_name || "Sua marca")}</strong>
        <span>${escapeHtml(d.main_phrase || dir.short)}</span>
        <small>${escapeHtml(d.package_instagram || d.instagram || "@instagram")}</small>
      </div>
    </div>
  `;
}

function updateMainPreview() {
  const el = $("mainPreview");
  if (!el) return;

  const selected = state.selected_direction || "premium";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = mockupHtml(selected).trim();

  const next = wrapper.firstElementChild;
  if (!next) return;

  el.className = next.className;
  el.setAttribute("style", next.getAttribute("style") || "");
  el.innerHTML = next.innerHTML;
}

function renderOptions() {
  const wrap = $("simulationOptions");
  if (!wrap) return;

  wrap.hidden = false;

  wrap.innerHTML = Object.entries(directions)
    .map(([key, dir]) => {
      const prompt = state.prompts[key] || makePrompt(formData(), key);

      return `
        <article class="simulation-card ${state.selected_direction === key ? "selected" : ""}" data-card="${key}">
          <span class="status">${state.selected_direction === key ? "Selecionado" : state.generated_images[key] ? "Imagem gerada" : "Pronto para gerar"}</span>
          <h3>${escapeHtml(dir.title)}</h3>
          <p>${escapeHtml(dir.description)}</p>
          ${mockupHtml(key)}
          <div class="prompt-mini">
            <pre>${escapeHtml(prompt)}</pre>
            <button type="button" data-copy="${key}">Copiar prompt</button>
          </div>
          <div class="card-actions">
            <button class="btn primary" type="button" data-select="${key}">Selecionar essa direção</button>
            <button class="btn ghost" type="button" data-adjust="${key}">Pedir ajuste</button>
          </div>
          <div class="adjust-box ${state.selected_direction === key && state.requested_adjustment ? "open" : ""}" data-adjust-box="${key}">
            <label>Descreva o que quer mudar
              <textarea data-adjust-text="${key}" placeholder="Ex: deixar mais premium, trocar cor, aumentar logo, tirar elementos tropicais, deixar mais moderno">${state.selected_direction === key ? escapeHtml(state.requested_adjustment) : ""}</textarea>
            </label>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateChosen() {
  const box = $("chosenDirection");
  const btn = $("sendSimulation");

  if (!box || !btn) return;

  if (state.selected_direction) {
    box.hidden = false;
    box.textContent = `Direção escolhida: ${directions[state.selected_direction].title}${state.requested_adjustment ? " • Ajuste solicitado: " + state.requested_adjustment : ""}`;
    btn.disabled = false;
  } else {
    box.hidden = true;
    btn.disabled = true;
  }

  window.visualSimulationPayload = visualSimulationPayload();
}

function imageFromResponse(data, key) {
  const urlKey = `${key}_image_url`;
  const b64Key = `${key}_image_base64`;

  if (data?.[urlKey]) return data[urlKey];
  if (data?.[b64Key]) return `data:image/png;base64,${data[b64Key]}`;

  if (data?.images?.[key]?.url) return data.images[key].url;
  if (data?.images?.[key]?.base64) return `data:image/png;base64,${data.images[key].base64}`;

  return "";
}

async function generateImagesFromWebhook() {
  buildPrompts();
  renderOptions();
  save();

  const btn = $("generateOptions");
  const originalText = btn ? btn.textContent : "";

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gerando imagens com IA...";
  }

  try {
    const response = await fetch(IMAGE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visualSimulationPayload()),
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || "Falha ao gerar imagens.");
    }

    const premium = imageFromResponse(data, "premium");
    const colorida = imageFromResponse(data, "colorida");
    const clean = imageFromResponse(data, "clean");

    if (premium) state.generated_images.premium = premium;
    if (colorida) state.generated_images.colorida = colorida;
    if (clean) state.generated_images.clean = clean;

    renderOptions();
    updateMainPreview();
    save();

    if (!premium && !colorida && !clean) {
      alert("O webhook respondeu, mas não retornou imagens. Os prompts continuam disponíveis.");
    }
  } catch (err) {
    console.error(err);
    alert("Não foi possível gerar as imagens agora. Os prompts continuam disponíveis para atendimento.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText || "Gerar opções de simulação";
    }
  }
}

function whatsUrl() {
  const p = visualSimulationPayload();
  const dir = directions[p.selected_direction];

  const msg = `Olá, quero enviar minha simulação Natucopos V2 para atendimento.

Dados do cliente:
Nome: ${p.customer.name}
WhatsApp: ${p.customer.whatsapp}
Cidade/Estado: ${p.customer.city_state}
Instagram: ${p.customer.instagram}

Embalagem: ${p.package.type}
Tamanho: ${p.package.size}
Marca: ${p.brand.name}
Estilo escolhido: ${p.briefing.visual_style}
Direção visual escolhida: ${dir ? dir.title : ""}
Ajuste solicitado: ${p.requested_adjustment || "Nenhum"}

Imagem Premium: ${p.generated_images.premium || "não gerada"}
Imagem Colorida: ${p.generated_images.colorida || "não gerada"}
Imagem Clean: ${p.generated_images.clean || "não gerada"}

Prompt técnico da direção escolhida:
${p.prompts[p.selected_direction] || ""}

Aviso: esta é uma simulação e não é arte final. A arte final passa por conferência humana antes da produção.`;

  return `https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(msg)}`;
}

load();
initChoices();
showStep(1);
updateMainPreview();

if (form) {
  form.addEventListener("input", (e) => {
    if (e.target.matches("[data-adjust-text]")) {
      state.selected_direction = e.target.dataset.adjustText;
      state.requested_adjustment = e.target.value;
      updateChosen();
    }

    save();
    updateMainPreview();
  });
}

$("nextBtn").onclick = () => {
  if (!validate()) return;
  if (currentStep < totalSteps) showStep(currentStep + 1);
};

$("prevBtn").onclick = () => showStep(currentStep - 1);

$("clearSimulation").onclick = () => {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
};

$("copyPrompt").onclick = () => {
  const text = $("generatedPrompt")?.textContent || "";
  navigator.clipboard.writeText(text);
};

$("generateOptions").onclick = generateImagesFromWebhook;

$("simulationOptions").addEventListener("click", (e) => {
  const copy = e.target.closest("[data-copy]");
  const select = e.target.closest("[data-select]");
  const adjust = e.target.closest("[data-adjust]");

  if (copy) {
    const key = copy.dataset.copy;
    navigator.clipboard.writeText(state.prompts[key] || makePrompt(formData(), key));
  }

  if (select) {
    state.selected_direction = select.dataset.select;
    renderOptions();
    updateChosen();
    save();
  }

  if (adjust) {
    const key = adjust.dataset.adjust;
    state.selected_direction = key;
    renderOptions();

    const box = document.querySelector(`[data-adjust-box="${key}"]`);
    if (box) {
      box.classList.add("open");
      const textarea = box.querySelector("textarea");
      if (textarea) textarea.focus();
    }

    updateChosen();
    save();
  }
});

$("sendSimulation").onclick = () => {
  if (!state.selected_direction) return;
  window.open(whatsUrl(), "_blank", "noopener");
};

$("startSimulation").onclick = () => {
  setTimeout(() => {
    safeElement("customer_name")?.focus();
  }, 450);
};