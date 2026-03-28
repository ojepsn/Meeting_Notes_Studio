const STORAGE_KEY = "notesmith-sessions";
const SETTINGS_KEY = "notesmith-settings";
const AI_MODEL_CATALOG_KEY = "notesmith-ai-model-catalog";

const templateDescriptions = {
  general: {
    label: "General meeting",
    summaryLead: "This meeting focused on key updates, decisions, and next steps.",
    sections: ["Overview", "Key Discussion Points", "Decisions", "Action Items"],
  },
  standup: {
    label: "Standup",
    summaryLead: "The standup reviewed progress, current blockers, and immediate priorities.",
    sections: ["Overview", "Progress Updates", "Blockers", "Next Actions"],
  },
  client: {
    label: "Client call",
    summaryLead: "The client conversation centered on needs, expectations, and agreed follow-ups.",
    sections: ["Overview", "Client Priorities", "Commitments", "Follow-Up Actions"],
  },
  oneOnOne: {
    label: "1:1",
    summaryLead: "The 1:1 covered current priorities, support needed, and development opportunities.",
    sections: ["Overview", "Topics Discussed", "Support Needed", "Next Steps"],
  },
  interview: {
    label: "Interview",
    summaryLead: "The interview explored background, strengths, and role alignment.",
    sections: ["Overview", "Candidate Highlights", "Signals", "Follow-Up Actions"],
  },
};

const sessionList = document.querySelector("#session-list");
const emptySessions = document.querySelector("#empty-sessions");
const newSessionButton = document.querySelector("#new-session");
const exportSessionsButton = document.querySelector("#export-sessions");
const importSessionsButton = document.querySelector("#import-sessions");
const saveLocalFileButton = document.querySelector("#save-local-file");
const importSessionsInput = document.querySelector("#import-sessions-input");
const sessionStorageStatus = document.querySelector("#session-storage-status");
const openSettingsButton = document.querySelector("#open-settings");
const openAiSettingsButton = document.querySelector("#open-ai-settings");
const settingsModal = document.querySelector("#settings-modal");
const closeSettingsBackdrop = document.querySelector("#close-settings");
const closeSettingsButton = document.querySelector("#close-settings-button");
const settingsForm = document.querySelector("#settings-form");
const themeFamilySelect = document.querySelector("#theme-family");
const themeModeSelect = document.querySelector("#theme-mode");
const settingsThemeDescription = document.querySelector("#settings-theme-description");
const aiSettingsModal = document.querySelector("#ai-settings-modal");
const closeAiSettingsBackdrop = document.querySelector("#close-ai-settings");
const closeAiSettingsButton = document.querySelector("#close-ai-settings-button");
const aiSettingsForm = document.querySelector("#ai-settings-form");
const titleDisplay = document.querySelector("#session-title");
const saveStatus = document.querySelector("#save-status");
const meetingTitleInput = document.querySelector("#meeting-title");
const templateSelect = document.querySelector("#meeting-template");
const apiKeyInput = document.querySelector("#api-key");
const modelSelect = document.querySelector("#model-select");
const modelOptions = document.querySelector("#model-options");
const modelPricingStatus = document.querySelector("#model-pricing-status");
const aiStatusCopy = document.querySelector("#ai-status-copy");
const participantsInput = document.querySelector("#participants");
const includeSummaryInput = document.querySelector("#include-summary");
const includeHighlightsInput = document.querySelector("#include-highlights");
const includeDecisionsInput = document.querySelector("#include-decisions");
const includeActionsInput = document.querySelector("#include-actions");
const detailLevelInput = document.querySelector("#detail-level");
const detailLevelLabel = document.querySelector("#detail-level-label");
const additionalInstructionsInput = document.querySelector("#additional-instructions");
const addCustomHeaderButton = document.querySelector("#add-custom-header");
const customHeaderList = document.querySelector("#custom-header-list");
const highlightsInput = document.querySelector("#highlights-input");
const highlightChips = document.querySelector("#highlight-chips");
const liveTranscriptInput = document.querySelector("#live-transcript");
const rawNotesInput = document.querySelector("#raw-notes");
const dictationLanguageSelect = document.querySelector("#dictation-language");
const polishButton = document.querySelector("#polish-notes");
const dictationToggle = document.querySelector("#dictation-toggle");
const dictationStatus = document.querySelector("#dictation-status");
const copyOutputButton = document.querySelector("#copy-output");
const exportWordButton = document.querySelector("#export-word");
const exportPdfButton = document.querySelector("#export-pdf");
const polishedOutput = document.querySelector("#polished-output");
const sessionItemTemplate = document.querySelector("#session-item-template");
const highlightChipTemplate = document.querySelector("#highlight-chip-template");
const customHeaderTemplate = document.querySelector("#custom-header-template");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const DICTATION_LANGUAGES = {
  swedish: "sv-SE",
  english: "en-US",
};
const OUTPUT_LANGUAGES = {
  swedish: "swedish",
  english: "english",
};
const SUPPORTS_FILE_SAVE = typeof window.showSaveFilePicker === "function";
const MAX_MODEL_INPUT_PRICE_PER_MILLION = 2.5;
const APPROX_TOKENS_PER_PAGE = 750;
const THEME_DESCRIPTIONS = {
  olive: "A calm olive palette designed for focused writing and professional notes.",
  blue: "A classic blue enterprise theme with a familiar SaaS feel.",
  teal: "A crisp teal palette for a clean, modern product look.",
  forest: "A graphite-forward theme with restrained forest-green accents.",
};
const DEFAULT_AI_MODEL_CATALOG = [
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models",
    useCase: "Use when you want the strongest note quality, nuanced restructuring, and the best professional polish.",
    inputPrice: "$2.50",
    cachedInputPrice: "$0.25",
    outputPrice: "$15.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5.4-pro",
    label: "GPT-5.4 pro",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-pro",
    useCase: "Use for especially high-stakes notes where precision matters more than latency or cost.",
    inputPrice: "$15.00",
    cachedInputPrice: null,
    outputPrice: "$120.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5",
    useCase: "Use for premium note polishing when you want very strong reasoning but lower cost than GPT-5.4.",
    inputPrice: "$1.25",
    cachedInputPrice: "$0.125",
    outputPrice: "$10.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5-mini",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models/gpt-5",
    useCase: "Use for the best quality-to-cost balance for everyday meetings. This is the recommended default.",
    inputPrice: "$0.25",
    cachedInputPrice: "$0.025",
    outputPrice: "$2.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models",
    useCase: "Use when you want near-frontier note quality at low cost and fast turnaround.",
    inputPrice: "$0.25",
    cachedInputPrice: "$0.025",
    outputPrice: "$2.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5.4-nano",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models",
    useCase: "Use for ultra-fast, lowest-cost cleanup where light polishing is enough.",
    inputPrice: "$0.05",
    cachedInputPrice: "$0.005",
    outputPrice: "$0.40",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-5-nano",
    label: "GPT-5 nano",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-5-nano",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models/gpt-5",
    useCase: "Use for the lowest-cost cleanup when speed matters more than nuanced phrasing or structure.",
    inputPrice: "$0.05",
    cachedInputPrice: "$0.005",
    outputPrice: "$0.40",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4.1",
    useCase: "Use if you want a strong non-reasoning model with stable text quality for polished summaries.",
    inputPrice: "$2.00",
    cachedInputPrice: "$0.50",
    outputPrice: "$8.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
    useCase: "Use for fast, lower-cost note formatting with solid quality on typical business meetings.",
    inputPrice: "$0.40",
    cachedInputPrice: "$0.10",
    outputPrice: "$1.60",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 nano",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-nano",
    useCase: "Use for extremely cost-sensitive workflows where you mainly want lightweight cleanup.",
    inputPrice: "$0.10",
    cachedInputPrice: "$0.025",
    outputPrice: "$0.40",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4o",
    useCase: "Use for versatile multimodal work or when you want a familiar general-purpose model for polished notes.",
    inputPrice: "$2.50",
    cachedInputPrice: "$1.25",
    outputPrice: "$10.00",
    pricingDate: "2026-03-28",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    docUrl: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
    fallbackDocUrl: "https://developers.openai.com/api/docs/models/gpt-4o",
    useCase: "Use for inexpensive, responsive note cleanup when you still want a capable mainstream model.",
    inputPrice: "$0.15",
    cachedInputPrice: "$0.075",
    outputPrice: "$0.60",
    pricingDate: "2026-03-28",
  },
];

let sessions = loadSessions();
let settings = loadSettings();
let aiModelCatalog = loadAiModelCatalog();
let activeSessionId = sessions[0]?.id ?? null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";
let dictationSeedText = "";
let currentDictationLanguage = getInitialDictationLanguage();
let pendingLanguageRestart = false;
let draftSaveTimeout = null;
let aiCatalogRefreshCounter = 0;

applyTheme(settings.themeFamily, settings.themeMode);
settings.model = resolveSelectedModel(settings.model);

if (!activeSessionId) {
  const initialSession = createSession();
  sessions = [initialSession];
  activeSessionId = initialSession.id;
  persistSessions();
}

setupSpeechRecognition();
render();
bindEvents();

function bindEvents() {
  newSessionButton.addEventListener("click", () => {
    const nextSession = createSession();
    sessions.unshift(nextSession);
    activeSessionId = nextSession.id;
    persistSessions();
    render();
    meetingTitleInput.focus();
  });

  exportSessionsButton.addEventListener("click", exportSessions);
  importSessionsButton.addEventListener("click", () => {
    importSessionsInput.click();
  });
  importSessionsInput.addEventListener("change", importSessionsFromFile);

  saveLocalFileButton.addEventListener("click", async () => {
    await saveSessionsToLocalFile();
  });

  openSettingsButton.addEventListener("click", openSettings);
  closeSettingsBackdrop.addEventListener("click", closeSettings);
  closeSettingsButton.addEventListener("click", closeSettings);
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings.themeFamily = themeFamilySelect.value;
    settings.themeMode = themeModeSelect.value;
    persistSettings();
    applyTheme(settings.themeFamily, settings.themeMode);
    syncSettingsForm();
    dictationStatus.textContent = `${getThemeDisplayName(settings.themeFamily)} ${settings.themeMode} theme saved.`;
    closeSettings();
  });
  themeFamilySelect.addEventListener("change", previewThemeSelection);
  themeModeSelect.addEventListener("change", previewThemeSelection);
  openAiSettingsButton.addEventListener("click", openAiSettings);
  closeAiSettingsBackdrop.addEventListener("click", closeAiSettings);
  closeAiSettingsButton.addEventListener("click", closeAiSettings);
  modelOptions.addEventListener("click", (event) => {
    const option = event.target.closest(".model-option");
    if (!option) {
      return;
    }

    modelSelect.value = option.dataset.modelId;
    renderAiModelOptions();
  });

  aiSettingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings.apiKey = apiKeyInput.value.trim();
    settings.model = resolveSelectedModel(modelSelect.value);
    persistSettings();
    updateAiStatusCopy();
    dictationStatus.textContent = settings.apiKey
      ? `AI settings saved. ${getAiModelLabel(settings.model)} is ready for polishing.`
      : "AI settings saved without an API key. Local polishing will be used until you add one.";
    closeAiSettings();
  });

  dictationLanguageSelect.addEventListener("change", () => {
    settings.dictationLanguage = dictationLanguageSelect.value;
    persistSettings();
    currentDictationLanguage = resolveDictationLanguage(rawNotesInput.value.trim() || navigator.language);

    if (recognition && !isRecording) {
      recognition.lang = currentDictationLanguage;
    }

    dictationStatus.textContent = settings.dictationLanguage === "auto"
      ? `Dictation language is set to Auto. Current preference: ${formatDictationLanguage(currentDictationLanguage)}.`
      : `Dictation language is locked to ${formatDictationLanguage(settings.dictationLanguage)}.`;
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsModal.classList.contains("is-hidden")) {
      closeSettings();
    }

    if (event.key === "Escape" && !aiSettingsModal.classList.contains("is-hidden")) {
      closeAiSettings();
    }
  });

  [
    meetingTitleInput,
    templateSelect,
    participantsInput,
    rawNotesInput,
  ].forEach((field) => {
    field.addEventListener("input", () => {
      updateActiveSession({
        [field.id === "meeting-title"
          ? "title"
          : field.id === "meeting-template"
            ? "template"
            : field.id === "participants"
              ? "participants"
              : "rawNotes"]: field.value,
      }, true);
    });
  });

  templateSelect.addEventListener("change", () => {
    const { label } = templateDescriptions[templateSelect.value];
    dictationStatus.textContent = `Template selected: ${label}. Click "Polish with AI" whenever you want a professional summary.`;
  });

  [
    includeSummaryInput,
    includeHighlightsInput,
    includeDecisionsInput,
    includeActionsInput,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      updateActiveSession({
        sections: {
          includeSummary: includeSummaryInput.checked,
          includeHighlights: includeHighlightsInput.checked,
          includeDecisions: includeDecisionsInput.checked,
          includeActions: includeActionsInput.checked,
        },
      }, true);
    });
  });

  detailLevelInput.addEventListener("input", () => {
    updateDetailLevelLabel();
    updateActiveSession({ detailLevel: Number(detailLevelInput.value) }, true);
  });

  additionalInstructionsInput.addEventListener("input", () => {
    updateActiveSession({ additionalInstructions: additionalInstructionsInput.value }, true);
  });

  addCustomHeaderButton.addEventListener("click", () => {
    const session = getActiveSession();
    const nextHeaders = [
      ...session.customHeaders,
      createCustomHeader(),
    ];
    updateActiveSession({ customHeaders: nextHeaders }, true);
  });

  customHeaderList.addEventListener("input", (event) => {
    const target = event.target;
    const item = target.closest(".custom-header-item");
    if (!item) {
      return;
    }

    const index = Number(item.dataset.index);
    const session = getActiveSession();
    const nextHeaders = session.customHeaders.map((header, currentIndex) => {
      if (currentIndex !== index) {
        return header;
      }

      return {
        ...header,
        title: item.querySelector(".custom-header-title").value,
        instructions: item.querySelector(".custom-header-instructions").value,
      };
    });
    updateActiveSessionSilently({ customHeaders: nextHeaders });
  });

  customHeaderList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".custom-header-remove");
    if (!removeButton) {
      return;
    }

    const item = removeButton.closest(".custom-header-item");
    const index = Number(item.dataset.index);
    const session = getActiveSession();
    const nextHeaders = session.customHeaders.filter((_, currentIndex) => currentIndex !== index);
    updateActiveSession({ customHeaders: nextHeaders }, true);
  });

  highlightsInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const value = highlightsInput.value.trim();

    if (!value) {
      return;
    }

    const session = getActiveSession();
    const nextHighlights = [...new Set([...session.highlights, value])];
    updateActiveSession({ highlights: nextHighlights }, true);
    highlightsInput.value = "";
  });

  polishButton.addEventListener("click", async () => {
    const session = getActiveSession();
    polishButton.disabled = true;
    polishButton.textContent = "Polishing...";
    saveStatus.textContent = "Generating with AI...";

    try {
      const polishedHtml = settings.apiKey
        ? await polishWithOpenAI(session, settings)
        : buildLocalPolishedNotes(session);

      updateActiveSession({ polishedHtml }, false);
      renderOutput();
      dictationStatus.textContent = settings.apiKey
        ? "AI polishing complete."
        : "No API key found in AI Settings, so a local polish pass was used instead.";
    } catch (error) {
      const polishedHtml = buildLocalPolishedNotes(session);
      updateActiveSession({ polishedHtml }, false);
      renderOutput();
      dictationStatus.textContent = `AI polishing failed: ${error.message}. A local polish pass was used instead.`;
    } finally {
      polishButton.disabled = false;
      polishButton.textContent = "Polish with AI";
      saveStatus.textContent = "Saved locally";
    }
  });

  dictationToggle.addEventListener("click", toggleDictation);

  copyOutputButton.addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session.polishedHtml) {
      dictationStatus.textContent = "Create polished notes first, then copy them from here.";
      return;
    }

    const textVersion = polishedOutput.innerText.trim();

    try {
      await navigator.clipboard.writeText(textVersion);
      dictationStatus.textContent = "Polished notes copied to your clipboard.";
    } catch {
      dictationStatus.textContent = "Clipboard access was blocked. You can still select and copy the text manually.";
    }
  });

  exportWordButton.addEventListener("click", () => {
    exportCurrentSessionAsWord();
  });

  exportPdfButton.addEventListener("click", () => {
    exportCurrentSessionAsPdf();
  });
}

function render() {
  renderSessionList();
  syncFieldsFromSession();
  renderHighlights();
  renderCustomHeaders();
  renderOutput();
  updateAiStatusCopy();
  updateSessionStorageUi();
  updateExportButtons();
  syncSettingsForm();
}

function renderSessionList() {
  sessionList.innerHTML = "";

  sessions.forEach((session) => {
    const fragment = sessionItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".session-button");
    const editButton = fragment.querySelector(".session-edit");
    const deleteButton = fragment.querySelector(".session-delete");
    const name = fragment.querySelector(".session-name");
    const meta = fragment.querySelector(".session-meta");

    name.textContent = session.title.trim() || "Untitled session";
    meta.textContent = `${templateDescriptions[session.template].label} - ${formatDate(session.updatedAt)}`;
    button.classList.toggle("is-active", session.id === activeSessionId);

    button.addEventListener("click", () => {
      activeSessionId = session.id;
      render();
    });

    editButton.addEventListener("click", () => {
      activeSessionId = session.id;
      render();
      meetingTitleInput.focus();
      meetingTitleInput.select();
    });

    deleteButton.addEventListener("click", () => {
      const sessionName = session.title.trim() || "Untitled session";
      const confirmed = window.confirm(`Are you sure you want to delete "${sessionName}"?`);

      if (!confirmed) {
        return;
      }

      deleteSession(session.id);
    });

    sessionList.appendChild(fragment);
  });

  emptySessions.classList.toggle("is-visible", sessions.length === 0);
}

function syncFieldsFromSession() {
  const session = getActiveSession();

  titleDisplay.textContent = session.title.trim() || "Untitled session";
  meetingTitleInput.value = session.title;
  templateSelect.value = session.template;
  apiKeyInput.value = settings.apiKey ?? "";
  modelSelect.value = resolveSelectedModel(settings.model);
  participantsInput.value = session.participants;
  includeSummaryInput.checked = session.sections.includeSummary;
  includeHighlightsInput.checked = session.sections.includeHighlights;
  includeDecisionsInput.checked = session.sections.includeDecisions;
  includeActionsInput.checked = session.sections.includeActions;
  detailLevelInput.value = String(session.detailLevel ?? 3);
  additionalInstructionsInput.value = session.additionalInstructions ?? "";
  updateDetailLevelLabel();
  dictationLanguageSelect.value = settings.dictationLanguage ?? "auto";
  liveTranscriptInput.value = session.liveTranscript ?? "";
  rawNotesInput.value = session.rawNotes;
  saveStatus.textContent = "Saved locally";
}

function openAiSettings() {
  apiKeyInput.value = settings.apiKey ?? "";
  modelSelect.value = resolveSelectedModel(settings.model);
  renderAiModelOptions();
  updateModelPricingStatus();
  aiSettingsModal.classList.remove("is-hidden");
  aiSettingsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  refreshAiModelCatalog();
  apiKeyInput.focus();
}

function closeAiSettings() {
  aiSettingsModal.classList.add("is-hidden");
  aiSettingsModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  openAiSettingsButton.focus();
}

function openSettings() {
  syncSettingsForm();
  settingsModal.classList.remove("is-hidden");
  settingsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
  themeFamilySelect.focus();
}

function closeSettings() {
  applyTheme(settings.themeFamily, settings.themeMode);
  settingsModal.classList.add("is-hidden");
  settingsModal.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
  openSettingsButton.focus();
}

function updateAiStatusCopy() {
  aiStatusCopy.innerHTML = settings.apiKey
    ? `AI polishing is connected with <strong>${escapeHtml(getAiModelLabel(settings.model))}</strong>. Open <strong>AI Settings</strong> to update or remove the key.`
    : `Open <strong>AI Settings</strong> to connect your OpenAI API key when you want AI polishing.`;
}

function syncModalScrollLock() {
  const hasOpenModal = !aiSettingsModal.classList.contains("is-hidden")
    || !settingsModal.classList.contains("is-hidden");
  document.body.classList.toggle("modal-open", hasOpenModal);
}

function renderAiModelOptions() {
  const selectedModel = resolveSelectedModel(modelSelect.value || settings.model);
  modelSelect.value = selectedModel;
  modelOptions.innerHTML = getVisibleAiModels()
    .map((model) => {
      const selectedClass = model.id === selectedModel ? " is-selected" : "";
      return `
        <button class="model-option${selectedClass}" data-model-id="${escapeHtml(model.id)}" type="button" aria-pressed="${String(model.id === selectedModel)}">
          <span class="model-option-header">
            <span class="model-option-name">${escapeHtml(model.label)}</span>
            <span class="model-option-badge">${model.id === selectedModel ? "Selected" : "Choose"}</span>
          </span>
          <span class="model-option-copy">${escapeHtml(model.useCase)}</span>
          <span class="model-option-price">${escapeHtml(formatModelPricing(model))}</span>
          <span class="model-option-meta">Pricing date: ${escapeHtml(formatCatalogDate(model.pricingDate))}</span>
        </button>
      `;
    })
    .join("");
}

function resolveSelectedModel(modelId) {
  const visibleModels = getVisibleAiModels();
  if (visibleModels.some((model) => model.id === modelId)) {
    return modelId;
  }

  return visibleModels.find((model) => model.id === "gpt-5-mini")?.id
    || visibleModels[0]?.id
    || "gpt-5-mini";
}

function getAiModelLabel(modelId) {
  return getVisibleAiModels().find((model) => model.id === resolveSelectedModel(modelId))?.label || "GPT-5 mini";
}

function updateModelPricingStatus(message) {
  if (message) {
    modelPricingStatus.textContent = message;
    return;
  }

  const latestDate = getVisibleAiModels()
    .map((model) => model.pricingDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  modelPricingStatus.textContent = latestDate
    ? `Showing cost-eligible OpenAI models from the latest saved snapshot on ${formatCatalogDate(latestDate)}. Live catalog refresh starts automatically when this window opens.`
    : "Showing bundled model guidance. Live pricing refresh starts automatically when this window opens.";
}

function getVisibleAiModels() {
  return filterRelevantAiModels(aiModelCatalog);
}

function filterRelevantAiModels(models) {
  return models
    .filter((model) => {
      const inputPrice = parsePrice(model.inputPrice);
      return Number.isFinite(inputPrice) && inputPrice <= MAX_MODEL_INPUT_PRICE_PER_MILLION;
    })
    .sort((first, second) => {
      const priceDelta = parsePrice(first.inputPrice) - parsePrice(second.inputPrice);
      if (priceDelta !== 0) {
        return priceDelta;
      }

      return first.label.localeCompare(second.label);
    });
}

async function refreshAiModelCatalog() {
  const refreshId = ++aiCatalogRefreshCounter;
  updateModelPricingStatus("Refreshing the official OpenAI model catalog and pricing in the background...");

  try {
    const refreshedCatalog = await fetchLatestAiModelCatalog();
    if (refreshId !== aiCatalogRefreshCounter) {
      return;
    }

    aiModelCatalog = refreshedCatalog;
    persistAiModelCatalog();
    renderAiModelOptions();
    updateModelPricingStatus(`Catalog refreshed from official OpenAI docs on ${formatCatalogDate(new Date().toISOString())}.`);
  } catch {
    if (refreshId !== aiCatalogRefreshCounter) {
      return;
    }

    updateModelPricingStatus("Using the saved model snapshot. Live catalog refresh from official OpenAI docs could not be completed in this browser.");
  }
}

async function fetchLatestAiModelCatalog() {
  const availableModelIds = await fetchAvailableOpenAiModelIds();
  const results = await Promise.allSettled(
    DEFAULT_AI_MODEL_CATALOG
      .filter((model) => availableModelIds.has(model.id))
      .map(async (model) => {
        const prices = await fetchOfficialModelPricing(model);
        return {
          ...model,
          ...prices,
          pricingDate: new Date().toISOString(),
        };
      }),
  );

  let successCount = 0;
  const availableCatalog = DEFAULT_AI_MODEL_CATALOG.filter((model) => availableModelIds.has(model.id));
  const mergedCatalog = availableCatalog.map((model, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      successCount += 1;
      return result.value;
    }

    const cachedModel = aiModelCatalog.find((item) => item.id === model.id);
    return cachedModel ? { ...model, ...cachedModel } : { ...model };
  });

  if (!successCount) {
    throw new Error("No official model pricing could be refreshed.");
  }

  return mergedCatalog;
}

async function fetchAvailableOpenAiModelIds() {
  const sources = [
    "https://developers.openai.com/api/docs/models/all",
    "https://developers.openai.com/api/docs/models",
  ];
  let combinedText = "";
  let successCount = 0;

  for (const url of sources) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
      combinedText += ` ${text}`;
      successCount += 1;
    } catch {
      // Ignore and fall back to the saved catalog if nothing can be fetched.
    }
  }

  if (!successCount) {
    return new Set(getVisibleAiModels().map((model) => model.id));
  }

  const normalizedText = combinedText.replace(/\s+/g, " ").trim().toLowerCase();
  const availableIds = DEFAULT_AI_MODEL_CATALOG
    .filter((model) => {
      const normalizedId = model.id.toLowerCase();
      const normalizedLabel = model.label.toLowerCase();
      return normalizedText.includes(normalizedId) || normalizedText.includes(normalizedLabel);
    })
    .map((model) => model.id);

  if (!availableIds.length) {
    return new Set(getVisibleAiModels().map((model) => model.id));
  }

  return new Set(availableIds);
}

async function fetchOfficialModelPricing(model) {
  const urls = [model.docUrl, model.fallbackDocUrl].filter(Boolean);
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
      const prices = extractModelPrices(text, model.label);

      if (prices) {
        return prices;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Pricing could not be loaded for ${model.label}.`);
}

function extractModelPrices(pageText, modelLabel) {
  const normalizedText = pageText.replace(/\s+/g, " ").trim();
  const modelSection = modelLabel === "GPT-5.4"
    ? normalizedText
    : extractModelSection(normalizedText, modelLabel);
  const pricingText = extractPricingSection(modelSection || normalizedText);

  if (!pricingText) {
    return null;
  }

  const inputMatch = pricingText.match(/Input\s*\$([\d.]+)/i);
  const cachedInputMatch = pricingText.match(/Cached input\s*\$([\d.]+)/i);
  const outputMatch = pricingText.match(/Output\s*\$([\d.]+)/i);

  if (!inputMatch || !outputMatch) {
    return null;
  }

  return {
    inputPrice: `$${inputMatch[1]}`,
    cachedInputPrice: cachedInputMatch ? `$${cachedInputMatch[1]}` : null,
    outputPrice: `$${outputMatch[1]}`,
  };
}

function extractModelSection(pageText, modelLabel) {
  const escapedLabel = modelLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`${escapedLabel}[\\s\\S]*?(?=(GPT-[\\d.]+(?: mini| nano| pro)?|Rate limits|Snapshots|Modalities|$))`, "i");
  return pageText.match(sectionPattern)?.[0] || pageText;
}

function extractPricingSection(pageText) {
  return pageText.match(/Text tokens[\s\S]*?(?=(Modalities|Endpoints|Features|Snapshots|Rate limits|$))/i)?.[0]
    || pageText.match(/Input price[\s\S]*?(?=(Latency|Max output|Context window|Tools|Knowledge cutoff|$))/i)?.[0]
    || pageText;
}

function formatModelPricing(model) {
  const parts = [`Input ${model.inputPrice} per 1 million tokens`];
  if (model.cachedInputPrice) {
    parts.push(`Cached input ${model.cachedInputPrice} per 1 million tokens`);
  }
  parts.push(`Output ${model.outputPrice} per 1 million tokens`);
  parts.push(`Approx. 1 page input: ${formatUsd(calculateApproxPageCost(model.inputPrice))}`);
  parts.push(`Approx. 1 page output: ${formatUsd(calculateApproxPageCost(model.outputPrice))}`);
  return parts.join(" • ");
}

function formatCatalogDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function parsePrice(value) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.replace(/[^0-9.]/g, "");
  return Number.parseFloat(normalized);
}

function calculateApproxPageCost(pricePerMillionTokens) {
  const parsedPrice = parsePrice(pricePerMillionTokens);
  if (!Number.isFinite(parsedPrice)) {
    return Number.NaN;
  }

  return (parsedPrice / 1_000_000) * APPROX_TOKENS_PER_PAGE;
}

function formatUsd(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(6)}`;
}

function renderHighlights() {
  const session = getActiveSession();
  highlightChips.innerHTML = "";

  session.highlights.forEach((highlight, index) => {
    const fragment = highlightChipTemplate.content.cloneNode(true);
    const chip = fragment.querySelector(".chip");
    const chipText = fragment.querySelector(".chip-text");

    chipText.textContent = highlight;
    chip.setAttribute("aria-label", `Remove highlight ${highlight}`);
    chip.addEventListener("click", () => {
      const nextHighlights = session.highlights.filter((_, currentIndex) => currentIndex !== index);
      updateActiveSession({ highlights: nextHighlights }, true);
    });

    highlightChips.appendChild(fragment);
  });
}

function renderCustomHeaders() {
  const session = getActiveSession();
  customHeaderList.innerHTML = "";

  session.customHeaders.forEach((header, index) => {
    const fragment = customHeaderTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".custom-header-item");
    const titleInput = fragment.querySelector(".custom-header-title");
    const instructionsInput = fragment.querySelector(".custom-header-instructions");

    item.dataset.index = String(index);
    titleInput.value = header.title;
    instructionsInput.value = header.instructions;

    customHeaderList.appendChild(fragment);
  });
}

function updateDetailLevelLabel() {
  detailLevelLabel.textContent = getDetailLevelLabel(Number(detailLevelInput.value));
}

function renderOutput() {
  const session = getActiveSession();

  if (!session.polishedHtml) {
    polishedOutput.innerHTML = `
      <div class="output-empty">
        <div>
          <h3>Your finished notes will appear here.</h3>
          <p>Write rough notes on the left, add a few highlights, then click <strong>Polish with AI</strong>.</p>
        </div>
      </div>
    `;
    return;
  }

  polishedOutput.innerHTML = session.polishedHtml;
}

function updateExportButtons() {
  const hasOutput = Boolean(getActiveSession()?.polishedHtml);
  exportWordButton.disabled = !hasOutput;
  exportPdfButton.disabled = !hasOutput;
}

function updateActiveSession(patch, shouldScheduleSave) {
  sessions = sessions.map((session) => {
    if (session.id !== activeSessionId) {
      return session;
    }

    return {
      ...session,
      ...patch,
      updatedAt: Date.now(),
    };
  });

  sessions.sort((first, second) => second.updatedAt - first.updatedAt);
  saveStatus.textContent = shouldScheduleSave ? "Saving..." : "Saved locally";
  renderSessionList();

  if (patch.title !== undefined) {
    titleDisplay.textContent = patch.title.trim() || "Untitled session";
  }

  if (patch.highlights !== undefined) {
    renderHighlights();
  }

  if (patch.customHeaders !== undefined) {
    renderCustomHeaders();
  }

  if (shouldScheduleSave) {
    schedulePersist();
  } else {
    persistSessions();
  }
}

function updateActiveSessionSilently(patch) {
  sessions = sessions.map((session) => {
    if (session.id !== activeSessionId) {
      return session;
    }

    return {
      ...session,
      ...patch,
      updatedAt: Date.now(),
    };
  });

  sessions.sort((first, second) => second.updatedAt - first.updatedAt);
  saveStatus.textContent = "Saving...";
  renderSessionList();
  schedulePersist();
}

function schedulePersist() {
  window.clearTimeout(draftSaveTimeout);
  draftSaveTimeout = window.setTimeout(() => {
    persistSessions();
    saveStatus.textContent = "Saved locally";
  }, 220);
}

function createSession() {
  return {
    id: crypto.randomUUID(),
    title: "",
    template: "general",
    participants: "",
    sections: createDefaultSections(),
    detailLevel: 3,
    additionalInstructions: "",
    customHeaders: [],
    highlights: [],
    liveTranscript: "",
    rawNotes: "",
    polishedHtml: "",
    updatedAt: Date.now(),
  };
}

function deleteSession(sessionId) {
  sessions = sessions.filter((session) => session.id !== sessionId);

  if (!sessions.length) {
    const nextSession = createSession();
    sessions = [nextSession];
    activeSessionId = nextSession.id;
  } else if (activeSessionId === sessionId) {
    activeSessionId = sessions[0].id;
  }

  persistSessions();
  render();
}

function getActiveSession() {
  return sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
}

function buildLocalPolishedNotes(session) {
  const template = templateDescriptions[session.template];
  const sectionConfig = normalizeSectionConfig(session.sections);
  const outputLanguage = detectOutputLanguage(session);
  const copy = getOutputCopy(outputLanguage);
  const normalizedLines = normalizeNotes(buildCombinedNotes(session));
  const grouped = splitIntoSections(normalizedLines, template.sections);
  const highlights = session.highlights.length ? session.highlights : deriveHighlights(normalizedLines);
  const actions = deriveActionItems(normalizedLines);
  const decisions = deriveDecisions(normalizedLines);
  const summary = buildSummary(session, template, normalizedLines, highlights, actions, outputLanguage);
  const customSectionsMarkup = buildLocalCustomSectionsMarkup(session, copy);
  const participants = session.participants
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const discussionMarkup = grouped.length
    ? grouped
        .map((group) => `
          <section class="output-section">
            <h4>${escapeHtml(localizeHeading(group.heading, copy))}</h4>
            <ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
        `)
        .join("")
    : `
      <section class="output-section">
        <h4>${escapeHtml(localizeHeading(template.sections[1], copy))}</h4>
        <p>${escapeHtml(copy.noDiscussion)}</p>
      </section>
    `;

  return `
    <article class="output-doc">
      <header class="output-header">
        <h3>${escapeHtml(session.title.trim() || "Untitled session")}</h3>
        <p class="output-meta">
          ${escapeHtml(template.label)} - ${formatDate(session.updatedAt)}
          ${participants.length ? ` - Participants: ${escapeHtml(participants.join(", "))}` : ""}
        </p>
      </header>

      ${sectionConfig.includeSummary ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.summaryHeading)}</h4>
          <p>${escapeHtml(summary)}</p>
        </section>
      ` : ""}

      ${sectionConfig.includeHighlights ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.highlightsHeading)}</h4>
            <ul>${toListMarkup(highlights, copy.noHighlights)}</ul>
        </section>
      ` : ""}

      ${discussionMarkup}

      ${customSectionsMarkup}

      ${sectionConfig.includeDecisions ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.decisionsHeading)}</h4>
            <ul>${toListMarkup(decisions, copy.noDecisions)}</ul>
        </section>
      ` : ""}

      ${sectionConfig.includeActions ? `
        <section class="output-section">
            <h4>${escapeHtml(copy.actionsHeading)}</h4>
            <ul>${toListMarkup(actions, copy.noActions)}</ul>
        </section>
      ` : ""}
    </article>
  `;
}

async function polishWithOpenAI(session, activeSettings) {
  const template = templateDescriptions[session.template];
  const outputLanguage = detectOutputLanguage(session);
  const prompt = buildAiPrompt(session, template, outputLanguage);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: activeSettings.model || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You turn rough meeting notes into polished professional notes. Be concise, accurate, and businesslike. Do not invent facts. If details are missing, stay neutral. Preserve the language of the source notes. If the notes are Swedish, write Swedish. If the notes are English, write English. Always focus on business-related discussion. Exclude private matters, social chatter, greetings, and small talk from the final output.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meeting_notes",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              highlights: {
                type: "array",
                items: { type: "string" },
              },
              discussionPoints: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    items: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["heading", "items"],
                },
              },
              decisions: {
                type: "array",
                items: { type: "string" },
              },
              actionItems: {
                type: "array",
                items: { type: "string" },
              },
              customSections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["heading", "content"],
                },
              },
            },
            required: ["title", "summary", "highlights", "discussionPoints", "decisions", "actionItems", "customSections"],
          },
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "The OpenAI request did not complete successfully.";
    throw new Error(message);
  }

  const responseText = extractResponseText(payload);

  if (!responseText) {
    throw new Error("The OpenAI response did not include any readable output text.");
  }

  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("The OpenAI response could not be parsed into structured notes.");
  }

  return buildAiOutputHtml(session, template, parsed, outputLanguage);
}

function buildAiPrompt(session, template, outputLanguage) {
  const sectionConfig = normalizeSectionConfig(session.sections);
  return [
    `Template: ${template.label}`,
    `Meeting title: ${session.title.trim() || "Untitled session"}`,
    `Participants: ${session.participants.trim() || "Not provided"}`,
    `User-added highlights: ${session.highlights.length ? session.highlights.join(" | ") : "None"}`,
    `Output language: ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}`,
    `Detail level: ${getDetailLevelLabel(session.detailLevel ?? 3)}`,
    `Include executive summary: ${sectionConfig.includeSummary ? "yes" : "no"}`,
    `Include highlights: ${sectionConfig.includeHighlights ? "yes" : "no"}`,
    `Include decisions: ${sectionConfig.includeDecisions ? "yes" : "no"}`,
    `Include action items: ${sectionConfig.includeActions ? "yes" : "no"}`,
    "Live transcript:",
    session.liveTranscript?.trim() || "No transcript provided.",
    "",
    "Manual notes:",
    session.rawNotes.trim() || "No manual notes provided.",
    "",
    "Custom headers and instructions:",
    formatCustomHeadersForPrompt(session.customHeaders),
    "",
    "Additional user instructions:",
    session.additionalInstructions?.trim() || "No additional instructions.",
    "",
    "Return polished meeting notes in the requested schema.",
    "Requirements:",
    "- Use a professional tone.",
    `- Write the output in ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}.`,
    `- Match this detail level: ${getDetailLevelLabel(session.detailLevel ?? 3)}.`,
    "- Keep the summary to 3-5 sentences.",
    "- Keep action items specific.",
    "- Only include decisions that are actually supported by the notes.",
    "- Use discussion point headings that fit the meeting.",
    "- Exclude private matters, greetings, and small talk. Keep the output focused on business discussion only.",
  ].join("\n");
}

function buildAiOutputHtml(session, template, aiNotes, outputLanguage) {
  const sectionConfig = normalizeSectionConfig(session.sections);
  const copy = getOutputCopy(outputLanguage);
  const customSectionsMarkup = buildAiCustomSectionsMarkup(aiNotes.customSections);
  const participants = session.participants
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const discussionMarkup = aiNotes.discussionPoints.length
    ? aiNotes.discussionPoints
        .map((group) => `
          <section class="output-section">
            <h4>${escapeHtml(group.heading)}</h4>
            <ul>${toListMarkup(group.items, copy.noDiscussionDetails)}</ul>
          </section>
        `)
        .join("")
    : `
      <section class="output-section">
        <h4>${escapeHtml(localizeHeading(template.sections[1], copy))}</h4>
        <p>${escapeHtml(copy.noDiscussion)}</p>
      </section>
    `;

  return `
    <article class="output-doc">
      <header class="output-header">
        <h3>${escapeHtml(aiNotes.title || session.title.trim() || "Untitled session")}</h3>
        <p class="output-meta">
          ${escapeHtml(template.label)} - ${formatDate(session.updatedAt)}
          ${participants.length ? ` - Participants: ${escapeHtml(participants.join(", "))}` : ""}
        </p>
      </header>

      ${sectionConfig.includeSummary ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.summaryHeading)}</h4>
          <p>${escapeHtml(aiNotes.summary)}</p>
        </section>
      ` : ""}

      ${sectionConfig.includeHighlights ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.highlightsHeading)}</h4>
          <ul>${toListMarkup(aiNotes.highlights, copy.noHighlights)}</ul>
        </section>
      ` : ""}

      ${discussionMarkup}

      ${customSectionsMarkup}

      ${sectionConfig.includeDecisions ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.decisionsHeading)}</h4>
          <ul>${toListMarkup(aiNotes.decisions, copy.noDecisions)}</ul>
        </section>
      ` : ""}

      ${sectionConfig.includeActions ? `
        <section class="output-section">
          <h4>${escapeHtml(copy.actionsHeading)}</h4>
          <ul>${toListMarkup(aiNotes.actionItems, copy.noActions)}</ul>
        </section>
      ` : ""}
    </article>
  `;
}

function createDefaultSections() {
  return {
    includeSummary: true,
    includeHighlights: true,
    includeDecisions: true,
    includeActions: true,
  };
}

function normalizeSectionConfig(sectionConfig) {
  return {
    ...createDefaultSections(),
    ...(sectionConfig || {}),
  };
}

function buildCombinedNotes(session) {
  return [session.liveTranscript?.trim(), session.rawNotes?.trim()]
    .filter(Boolean)
    .join("\n\n");
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload?.output)) {
    return "";
  }

  const textParts = payload.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean);

  return textParts.join("\n").trim();
}

function normalizeNotes(rawNotes) {
  return rawNotes
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*\-\u2022]+/, "").trim())
    .filter(Boolean);
}

function splitIntoSections(lines, headings) {
  if (!lines.length) {
    return [];
  }

  const groups = headings.map((heading) => ({ heading, items: [] }));

  lines.forEach((line, index) => {
    const targetIndex = Math.min(index % groups.length, groups.length - 1);
    groups[targetIndex].items.push(toSentence(line));
  });

  return groups.filter((group) => group.items.length);
}

function deriveHighlights(lines) {
  return lines.slice(0, 3).map((line) => toSentence(line));
}

function deriveActionItems(lines) {
  const actionLines = lines.filter((line) =>
    /(^todo\b|^action\b|^next\b|follow up|send|share|prepare|review|deliver|schedule|confirm|update)/i.test(line)
  );

  return uniqueItems(actionLines.length ? actionLines : lines.filter((_, index) => index % 3 === 0).slice(0, 4))
    .map((line) => toActionSentence(line));
}

function deriveDecisions(lines) {
  const decisionLines = lines.filter((line) =>
    /(decided|decision|agreed|approved|will use|chosen|selected|prioritized)/i.test(line)
  );

  return uniqueItems(decisionLines).map((line) => toSentence(line));
}

function buildSummary(session, template, lines, highlights, actions, outputLanguage = OUTPUT_LANGUAGES.english) {
  const parts = [
    outputLanguage === OUTPUT_LANGUAGES.swedish
      ? localizeSummaryLead(template.summaryLead)
      : template.summaryLead,
  ];

  if (highlights.length) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? `Viktiga teman var ${joinNaturalLanguage(highlights.slice(0, 3).map((item) => item.toLowerCase()), outputLanguage)}.`
        : `Key themes included ${joinNaturalLanguage(highlights.slice(0, 3).map((item) => item.toLowerCase()), outputLanguage)}.`
    );
  }

  if (actions.length) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? `M\u00f6tet avslutades med ${actions.length} konkreta ${actions.length === 1 ? "uppf\u00f6ljningspunkt" : "uppf\u00f6ljningspunkter"}.`
        : `The meeting closed with ${actions.length} concrete follow-up ${actions.length === 1 ? "item" : "items"}.`
    );
  } else if (lines.length) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? "De insamlade anteckningarna organiserades till en tydligare skriftlig sammanfattning f\u00f6r uppf\u00f6ljning."
        : "The captured notes were organized into a clearer written record for follow-up."
    );
  }

  if (!session.rawNotes.trim()) {
    parts.push(
      outputLanguage === OUTPUT_LANGUAGES.swedish
        ? "L\u00e4gg till anteckningar f\u00f6r att skapa en mer inneh\u00e5llsrik sammanfattning."
        : "Add raw notes to generate a richer summary."
    );
  }

  return parts.join(" ");
}

function toListMarkup(items, fallback) {
  if (!items.length) {
    return `<li>${escapeHtml(fallback)}</li>`;
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function toSentence(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function toActionSentence(text) {
  const cleaned = text.replace(/^(todo|action|next)\s*[:\-]?\s*/i, "").trim();
  if (!cleaned) {
    return "";
  }

  const sentence = toSentence(cleaned);
  return sentence.startsWith("Need to") || sentence.startsWith("Please")
    ? sentence
    : `Follow up to ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function joinNaturalLanguage(items, outputLanguage = OUTPUT_LANGUAGES.english) {
  if (items.length <= 1) {
    return items[0] ?? (outputLanguage === OUTPUT_LANGUAGES.swedish ? "flera viktiga diskussionspunkter" : "several important discussion points");
  }

  if (items.length === 2) {
    return `${items[0]} ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "och" : "and"} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "och" : "and"} ${items.at(-1)}`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    dictationToggle.disabled = true;
    dictationToggle.textContent = "Dictation Unavailable";
    dictationStatus.textContent = "This browser does not expose speech recognition, but the rest of the app is ready to use.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = resolveDictationLanguage(rawNotesInput.value.trim() || navigator.language);

  recognition.addEventListener("result", (event) => {
    let interimTranscript = "";
    let detectedLanguage = currentDictationLanguage;

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      detectedLanguage = settings.dictationLanguage === "auto"
        ? detectPreferredLanguage(transcript, detectedLanguage)
        : settings.dictationLanguage;
      if (event.results[index].isFinal) {
        finalTranscript += `${transcript.trim()} `;
      } else {
        interimTranscript += transcript;
      }
    }

    const nextValue = [dictationSeedText.trim(), finalTranscript.trim(), interimTranscript.trim()]
      .filter(Boolean)
      .join(dictationSeedText.trim() ? "\n" : "");

    liveTranscriptInput.value = nextValue;
    updateActiveSession({ liveTranscript: nextValue }, true);
    dictationStatus.textContent = `Dictation is active in ${formatDictationLanguage(currentDictationLanguage)}. Keep talking and your notes will appear in the live transcript field.`;

    if (settings.dictationLanguage === "auto" && detectedLanguage !== currentDictationLanguage) {
      currentDictationLanguage = detectedLanguage;
      recognition.lang = currentDictationLanguage;
      pendingLanguageRestart = true;
      recognition.stop();
    }
  });

  recognition.addEventListener("end", () => {
    if (isRecording) {
      recognition.lang = currentDictationLanguage;
      pendingLanguageRestart = false;
      recognition.start();
      return;
    }

    finalTranscript = "";
    dictationSeedText = "";
    pendingLanguageRestart = false;
    dictationToggle.textContent = "Start Dictation";
    dictationToggle.classList.remove("is-recording");
    dictationStatus.textContent = "Dictation stopped. You can continue typing or restart capture anytime.";
  });

  recognition.addEventListener("error", (event) => {
    isRecording = false;
    finalTranscript = "";
    dictationSeedText = "";
    pendingLanguageRestart = false;
    dictationToggle.textContent = "Start Dictation";
    dictationToggle.classList.remove("is-recording");
    dictationStatus.textContent = `Dictation error: ${event.error}. You can still take notes manually.`;
  });
}

function toggleDictation() {
  if (!recognition) {
    return;
  }

  if (isRecording) {
    isRecording = false;
    recognition.stop();
    return;
  }

  isRecording = true;
  finalTranscript = "";
  dictationSeedText = liveTranscriptInput.value.trim();
  currentDictationLanguage = resolveDictationLanguage(dictationSeedText || navigator.language);
  recognition.lang = currentDictationLanguage;
  recognition.start();
  dictationToggle.textContent = "Stop Dictation";
  dictationToggle.classList.add("is-recording");
  dictationStatus.textContent = `Listening in ${formatDictationLanguage(currentDictationLanguage)}. The app will switch between Swedish and English when the speech pattern changes.`;
}

function loadSessions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? normalizeImportedSessions(parsed) : [];
  } catch {
    return [];
  }
}

function persistSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadAiModelCatalog() {
  try {
    const stored = localStorage.getItem(AI_MODEL_CATALOG_KEY);
    if (!stored) {
      return filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({ ...model })));
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.length) {
      return filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({ ...model })));
    }

    const byId = new Map(parsed.map((model) => [model.id, model]));
    return filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({
      ...model,
      ...(byId.get(model.id) || {}),
    })));
  } catch {
    return filterRelevantAiModels(DEFAULT_AI_MODEL_CATALOG.map((model) => ({ ...model })));
  }
}

function persistAiModelCatalog() {
  localStorage.setItem(AI_MODEL_CATALOG_KEY, JSON.stringify(aiModelCatalog));
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return {
        apiKey: "",
        model: "gpt-5-mini",
        dictationLanguage: "auto",
        themeFamily: "olive",
        themeMode: "light",
      };
    }

    const parsed = JSON.parse(stored);
    const legacyThemeMode = parsed.theme === "dark" ? "dark" : "light";

    return {
      apiKey: "",
      model: "gpt-5-mini",
      dictationLanguage: "auto",
      themeFamily: "olive",
      themeMode: legacyThemeMode,
      ...parsed,
    };
  } catch {
    return {
      apiKey: "",
      model: "gpt-5-mini",
      dictationLanguage: "auto",
      themeFamily: "olive",
      themeMode: "light",
    };
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applyTheme(themeFamily, themeMode) {
  const resolvedFamily = THEME_DESCRIPTIONS[themeFamily] ? themeFamily : "olive";
  const resolvedMode = themeMode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", `${resolvedFamily}-${resolvedMode}`);
}

function syncSettingsForm() {
  themeFamilySelect.value = THEME_DESCRIPTIONS[settings.themeFamily] ? settings.themeFamily : "olive";
  themeModeSelect.value = settings.themeMode === "dark" ? "dark" : "light";
  updateThemeDescription();
}

function getThemeDisplayName(themeFamily) {
  const themeNames = {
    olive: "Modern Olive",
    blue: "Classic Blue SaaS",
    teal: "Teal Enterprise",
    forest: "Graphite Forest",
  };

  return themeNames[themeFamily] || themeNames.olive;
}

function updateThemeDescription() {
  settingsThemeDescription.textContent = THEME_DESCRIPTIONS[themeFamilySelect.value] || THEME_DESCRIPTIONS.olive;
}

function previewThemeSelection() {
  applyTheme(themeFamilySelect.value, themeModeSelect.value);
  updateThemeDescription();
}

function updateSessionStorageUi() {
  saveLocalFileButton.disabled = !SUPPORTS_FILE_SAVE;
  sessionStorageStatus.textContent = SUPPORTS_FILE_SAVE
    ? "Export sessions to a file, import them later, or save directly to a local file on this browser."
    : "Export and import sessions are available here. Direct local file saving depends on browser support and is unavailable in this browser.";
}

function buildSessionsExportPayload() {
  return {
    app: "Meeting Notes Studio",
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessions,
  };
}

function exportCurrentSessionAsWord() {
  const session = getActiveSession();

  if (!session?.polishedHtml) {
    dictationStatus.textContent = "Create polished notes first, then export the session.";
    return;
  }

  const title = session.title.trim() || "Meeting Notes";
  const documentHtml = buildWordDocumentHtml(title, session.polishedHtml);
  const blob = new Blob([documentHtml], { type: "application/msword" });
  downloadBlob(blob, `${toFileSafeName(title)}.doc`);
  dictationStatus.textContent = "The current session was exported as a Word document.";
}

function exportCurrentSessionAsPdf() {
  const session = getActiveSession();

  if (!session?.polishedHtml) {
    dictationStatus.textContent = "Create polished notes first, then export the session.";
    return;
  }

  if (!window.jspdf?.jsPDF) {
    dictationStatus.textContent = "PDF export is unavailable because the PDF library did not load.";
    return;
  }

  const exportData = getCurrentSessionExportData();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 56;

  const ensurePageSpace = (heightNeeded = 22) => {
    if (cursorY + heightNeeded <= pageHeight - margin) {
      return;
    }

    pdf.addPage();
    cursorY = 56;
  };

  const writeLines = (text, fontSize = 11, lineHeight = 18) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      ensurePageSpace(lineHeight);
      pdf.text(line, margin, cursorY);
      cursorY += lineHeight;
    });
  };

  pdf.setFont("times", "bold");
  pdf.setFontSize(22);
  pdf.text(exportData.title, margin, cursorY);
  cursorY += 28;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  writeLines(exportData.meta, 10, 15);
  cursorY += 10;

  exportData.sections.forEach((section) => {
    ensurePageSpace(26);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(section.heading, margin, cursorY);
    cursorY += 18;

    if (section.type === "list") {
      section.items.forEach((item) => {
        const bulletLines = pdf.splitTextToSize(`• ${item}`, contentWidth - 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        bulletLines.forEach((line) => {
          ensurePageSpace(16);
          pdf.text(line, margin + 8, cursorY);
          cursorY += 16;
        });
      });
    } else {
      writeLines(section.text, 11, 17);
    }

    cursorY += 8;
  });

  pdf.save(`${toFileSafeName(exportData.title)}.pdf`);
  dictationStatus.textContent = "The current session was exported as a PDF document.";
}

function getCurrentSessionExportData() {
  const session = getActiveSession();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = session.polishedHtml;

  const title = wrapper.querySelector(".output-header h3")?.textContent?.trim() || session.title.trim() || "Meeting Notes";
  const meta = wrapper.querySelector(".output-meta")?.textContent?.replace(/\s+/g, " ").trim() || "";
  const sections = [...wrapper.querySelectorAll(".output-section")].map((section) => {
    const heading = section.querySelector("h4")?.textContent?.trim() || "";
    const listItems = [...section.querySelectorAll("li")].map((item) => item.textContent.trim()).filter(Boolean);
    const paragraphText = [...section.querySelectorAll("p")]
      .map((item) => item.textContent.trim())
      .filter(Boolean)
      .join(" ");

    if (listItems.length) {
      return {
        heading,
        type: "list",
        items: listItems,
      };
    }

    return {
      heading,
      type: "text",
      text: paragraphText,
    };
  });

  return { title, meta, sections };
}

function buildWordDocumentHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f1f1f; margin: 40px; line-height: 1.55; }
    h3 { font-family: Georgia, serif; font-size: 24pt; margin: 0 0 10px; }
    h4 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.08em; margin: 24px 0 10px; color: #5b3f2a; }
    p { margin: 0 0 10px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 0 0 8px; }
    .output-header { border-bottom: 1px solid #d8d1c6; padding-bottom: 12px; margin-bottom: 18px; }
    .output-meta { color: #6d6258; }
    .output-doc { display: block; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toFileSafeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "meeting-notes";
}

function exportSessions() {
  const payload = buildSessionsExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `meeting-notes-sessions-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  sessionStorageStatus.textContent = "Sessions exported to a JSON file.";
}

async function importSessionsFromFile(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedSessions = Array.isArray(payload) ? payload : payload.sessions;

    if (!Array.isArray(importedSessions) || !importedSessions.length) {
      throw new Error("No valid sessions were found in that file.");
    }

    sessions = normalizeImportedSessions(importedSessions);
    activeSessionId = sessions[0].id;
    persistSessions();
    render();
    sessionStorageStatus.textContent = `Imported ${sessions.length} session${sessions.length === 1 ? "" : "s"} from file.`;
  } catch (error) {
    sessionStorageStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    importSessionsInput.value = "";
  }
}

async function saveSessionsToLocalFile() {
  if (!SUPPORTS_FILE_SAVE) {
    sessionStorageStatus.textContent = "Direct local file saving is not supported in this browser.";
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `meeting-notes-sessions-${new Date().toISOString().slice(0, 10)}.json`,
      types: [
        {
          description: "JSON files",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(buildSessionsExportPayload(), null, 2));
    await writable.close();
    sessionStorageStatus.textContent = "Sessions were saved to your chosen local file.";
  } catch (error) {
    if (error?.name === "AbortError") {
      sessionStorageStatus.textContent = "Local file save was cancelled.";
      return;
    }

    sessionStorageStatus.textContent = `Local file save failed: ${error.message}`;
  }
}

function normalizeImportedSessions(importedSessions) {
  return importedSessions
    .filter((session) => session && typeof session === "object")
    .map((session) => ({
      id: typeof session.id === "string" && session.id ? session.id : crypto.randomUUID(),
      title: typeof session.title === "string" ? session.title : "",
      template: typeof session.template === "string" && templateDescriptions[session.template] ? session.template : "general",
      participants: typeof session.participants === "string" ? session.participants : "",
      sections: normalizeSectionConfig(session.sections),
      detailLevel: normalizeDetailLevel(session.detailLevel),
      additionalInstructions: typeof session.additionalInstructions === "string" ? session.additionalInstructions : "",
      customHeaders: normalizeCustomHeaders(session.customHeaders),
      highlights: Array.isArray(session.highlights) ? session.highlights.filter((item) => typeof item === "string") : [],
      liveTranscript: typeof session.liveTranscript === "string" ? session.liveTranscript : "",
      rawNotes: typeof session.rawNotes === "string" ? session.rawNotes : "",
      polishedHtml: typeof session.polishedHtml === "string" ? session.polishedHtml : "",
      updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
    }))
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

function createCustomHeader() {
  return {
    id: crypto.randomUUID(),
    title: "",
    instructions: "",
  };
}

function normalizeCustomHeaders(customHeaders) {
  if (!Array.isArray(customHeaders)) {
    return [];
  }

  return customHeaders
    .filter((header) => header && typeof header === "object")
    .map((header) => ({
      id: typeof header.id === "string" && header.id ? header.id : crypto.randomUUID(),
      title: typeof header.title === "string" ? header.title : "",
      instructions: typeof header.instructions === "string" ? header.instructions : "",
    }));
}

function normalizeDetailLevel(detailLevel) {
  const parsed = Number(detailLevel);
  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(parsed)));
}

function getDetailLevelLabel(detailLevel) {
  const labels = {
    1: "Very short and concise",
    2: "Concise",
    3: "Balanced detail",
    4: "Detailed",
    5: "Very detailed",
  };

  return labels[normalizeDetailLevel(detailLevel)];
}

function formatCustomHeadersForPrompt(customHeaders) {
  if (!customHeaders.length) {
    return "No custom headers.";
  }

  return customHeaders
    .map((header, index) => {
      const title = header.title.trim() || `Custom Header ${index + 1}`;
      const instructions = header.instructions.trim() || "No extra instructions.";
      return `${index + 1}. ${title}: ${instructions}`;
    })
    .join("\n");
}

function buildLocalCustomSectionsMarkup(session, copy) {
  const customHeaders = session.customHeaders.filter((header) => header.title.trim());

  return customHeaders
    .map((header) => `
      <section class="output-section">
        <h4>${escapeHtml(header.title.trim())}</h4>
        <p>${escapeHtml(copy.customSectionFallback)}</p>
      </section>
    `)
    .join("");
}

function buildAiCustomSectionsMarkup(customSections = []) {
  return customSections
    .filter((section) => section.heading?.trim() && section.content?.trim())
    .map((section) => `
      <section class="output-section">
        <h4>${escapeHtml(section.heading.trim())}</h4>
        <p>${escapeHtml(section.content.trim())}</p>
      </section>
    `)
    .join("");
}

function detectOutputLanguage(session) {
  const sample = [
    session.title,
    session.participants,
    ...(session.highlights || []),
    session.rawNotes,
  ]
    .filter(Boolean)
    .join(" ");

  return detectPreferredLanguage(sample || navigator.language, DICTATION_LANGUAGES.english) === DICTATION_LANGUAGES.swedish
    ? OUTPUT_LANGUAGES.swedish
    : OUTPUT_LANGUAGES.english;
}

function getOutputCopy(outputLanguage) {
  if (outputLanguage === OUTPUT_LANGUAGES.swedish) {
    return {
      summaryHeading: "Sammanfattning",
      highlightsHeading: "H\u00f6jdpunkter",
      decisionsHeading: "Beslut",
      actionsHeading: "\u00c5tg\u00e4rder",
      participantsLabel: "Deltagare",
      noHighlights: "Inga h\u00f6jdpunkter har lagts till \u00e4n.",
      noDecisions: "Inga tydliga beslut dokumenterades.",
      noActions: "Inga \u00e5tg\u00e4rder identifierades.",
      noDiscussion: "Inga detaljerade diskussionspunkter har registrerats \u00e4n.",
      noDiscussionDetails: "Inga detaljer registrerades.",
      customSectionFallback: "Den h\u00e4r anpassade sektionen \u00e4r b\u00e4st att generera med AI-polering.",
      headingMap: {
        Overview: "\u00d6versikt",
        "Key Discussion Points": "Viktiga diskussionspunkter",
        Decisions: "Beslut",
        "Action Items": "\u00c5tg\u00e4rder",
        "Progress Updates": "Statusuppdateringar",
        Blockers: "Blockerare",
        "Next Actions": "N\u00e4sta steg",
        "Client Priorities": "Kundprioriteringar",
        Commitments: "\u00c5taganden",
        "Follow-Up Actions": "Uppf\u00f6ljnings\u00e5tg\u00e4rder",
        "Topics Discussed": "Diskuterade \u00e4mnen",
        "Support Needed": "Behov av st\u00f6d",
        "Next Steps": "N\u00e4sta steg",
        "Candidate Highlights": "Kandidatens styrkor",
        Signals: "Observationer",
      },
    };
  }

  return {
    summaryHeading: "Executive Summary",
    highlightsHeading: "Highlights",
    decisionsHeading: "Decisions",
    actionsHeading: "Action Items",
    participantsLabel: "Participants",
    noHighlights: "No highlights added yet.",
    noDecisions: "No explicit decisions were recorded.",
    noActions: "No action items were identified.",
    noDiscussion: "No detailed discussion points were captured yet.",
    noDiscussionDetails: "No details captured.",
    customSectionFallback: "This custom section is best generated with AI polishing.",
    headingMap: {},
  };
}

function localizeHeading(heading, copy) {
  return copy.headingMap?.[heading] || heading;
}

function getInitialDictationLanguage() {
  return /^sv\b/i.test(navigator.language || "")
    ? DICTATION_LANGUAGES.swedish
    : DICTATION_LANGUAGES.english;
}

function resolveDictationLanguage(sampleText) {
  if (settings.dictationLanguage && settings.dictationLanguage !== "auto") {
    return settings.dictationLanguage;
  }

  return detectPreferredLanguage(sampleText, getInitialDictationLanguage());
}

function detectPreferredLanguage(text, fallbackLanguage) {
  const sample = (text || "").toLowerCase();
  const swedishScore = scoreLanguage(sample, [
    /\b(och|det|att|som|inte|med|f\u00f6r|har|p\u00e5|\u00e4r|vi|ska|ocks\u00e5|m\u00f6te|beslut|\u00e5tg\u00e4rd|uppf\u00f6ljning|n\u00e4sta|deltagare|sammanfattning)\b/g,
    /[\u00e5\u00e4\u00f6]/g,
  ]);
  const englishScore = scoreLanguage(sample, [
    /\b(and|the|that|with|for|not|have|this|will|meeting|decision|action|follow-up|summary|next|participants)\b/g,
  ]);
  const normalizedFallback = fallbackLanguage || getInitialDictationLanguage();
  const scoreDelta = swedishScore - englishScore;

  if (sample.length < 12) {
    return normalizedFallback;
  }

  if (/[\u00e5\u00e4\u00f6]/.test(sample) || /\b(jag|detta|ocks\u00e5|m\u00f6te|n\u00e4sta|uppf\u00f6ljning)\b/.test(sample)) {
    return DICTATION_LANGUAGES.swedish;
  }

  if (/\b(the|and|with|meeting|summary|action items)\b/.test(sample) && englishScore >= swedishScore + 2) {
    return DICTATION_LANGUAGES.english;
  }

  if (Math.abs(scoreDelta) < 2) {
    return normalizedFallback;
  }

  return scoreDelta > 0 ? DICTATION_LANGUAGES.swedish : DICTATION_LANGUAGES.english;
}



function scoreLanguage(sample, patterns) {
  return patterns.reduce((score, pattern) => {
    const matches = sample.match(pattern);
    return score + (matches ? matches.length : 0);
  }, 0);
}

function formatDictationLanguage(languageCode) {
  return languageCode === DICTATION_LANGUAGES.swedish ? "Swedish" : "English";
}

function localizeSummaryLead(summaryLead) {
  const translations = {
    "This meeting focused on key updates, decisions, and next steps.": "M\u00f6tet fokuserade p\u00e5 viktiga uppdateringar, beslut och n\u00e4sta steg.",
    "The standup reviewed progress, current blockers, and immediate priorities.": "Standupen gick igenom framsteg, aktuella hinder och omedelbara prioriteringar.",
    "The client conversation centered on needs, expectations, and agreed follow-ups.": "Kundsamtalet fokuserade p\u00e5 behov, f\u00f6rv\u00e4ntningar och \u00f6verenskomna uppf\u00f6ljningar.",
    "The 1:1 covered current priorities, support needed, and development opportunities.": "1:1-m\u00f6tet tog upp aktuella prioriteringar, behov av st\u00f6d och utvecklingsm\u00f6jligheter.",
    "The interview explored background, strengths, and role alignment.": "Intervjun behandlade bakgrund, styrkor och hur kandidaten passar rollen.",
  };

  return translations[summaryLead] || summaryLead;
}



