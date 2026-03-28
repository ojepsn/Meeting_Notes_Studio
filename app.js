const STORAGE_KEY = "notesmith-sessions";
const SETTINGS_KEY = "notesmith-settings";

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
const openAiSettingsButton = document.querySelector("#open-ai-settings");
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
const aiStatusCopy = document.querySelector("#ai-status-copy");
const participantsInput = document.querySelector("#participants");
const includeSummaryInput = document.querySelector("#include-summary");
const includeHighlightsInput = document.querySelector("#include-highlights");
const includeDecisionsInput = document.querySelector("#include-decisions");
const includeActionsInput = document.querySelector("#include-actions");
const highlightsInput = document.querySelector("#highlights-input");
const highlightChips = document.querySelector("#highlight-chips");
const liveTranscriptInput = document.querySelector("#live-transcript");
const rawNotesInput = document.querySelector("#raw-notes");
const dictationLanguageSelect = document.querySelector("#dictation-language");
const polishButton = document.querySelector("#polish-notes");
const dictationToggle = document.querySelector("#dictation-toggle");
const dictationStatus = document.querySelector("#dictation-status");
const copyOutputButton = document.querySelector("#copy-output");
const polishedOutput = document.querySelector("#polished-output");
const sessionItemTemplate = document.querySelector("#session-item-template");
const highlightChipTemplate = document.querySelector("#highlight-chip-template");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const DICTATION_LANGUAGES = {
  swedish: "sv-SE",
  english: "en-US",
};
const OUTPUT_LANGUAGES = {
  swedish: "swedish",
  english: "english",
};

let sessions = loadSessions();
let settings = loadSettings();
let activeSessionId = sessions[0]?.id ?? null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";
let dictationSeedText = "";
let currentDictationLanguage = getInitialDictationLanguage();
let pendingLanguageRestart = false;
let draftSaveTimeout = null;

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

  openAiSettingsButton.addEventListener("click", openAiSettings);
  closeAiSettingsBackdrop.addEventListener("click", closeAiSettings);
  closeAiSettingsButton.addEventListener("click", closeAiSettings);

  aiSettingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings.apiKey = apiKeyInput.value.trim();
    settings.model = modelSelect.value;
    persistSettings();
    updateAiStatusCopy();
    dictationStatus.textContent = settings.apiKey
      ? `AI settings saved. ${settings.model} is ready for polishing.`
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
}

function render() {
  renderSessionList();
  syncFieldsFromSession();
  renderHighlights();
  renderOutput();
  updateAiStatusCopy();
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
  modelSelect.value = settings.model ?? "gpt-5-mini";
  participantsInput.value = session.participants;
  includeSummaryInput.checked = session.sections.includeSummary;
  includeHighlightsInput.checked = session.sections.includeHighlights;
  includeDecisionsInput.checked = session.sections.includeDecisions;
  includeActionsInput.checked = session.sections.includeActions;
  dictationLanguageSelect.value = settings.dictationLanguage ?? "auto";
  liveTranscriptInput.value = session.liveTranscript ?? "";
  rawNotesInput.value = session.rawNotes;
  saveStatus.textContent = "Saved locally";
}

function openAiSettings() {
  apiKeyInput.value = settings.apiKey ?? "";
  modelSelect.value = settings.model ?? "gpt-5-mini";
  aiSettingsModal.classList.remove("is-hidden");
  aiSettingsModal.setAttribute("aria-hidden", "false");
  apiKeyInput.focus();
}

function closeAiSettings() {
  aiSettingsModal.classList.add("is-hidden");
  aiSettingsModal.setAttribute("aria-hidden", "true");
  openAiSettingsButton.focus();
}

function updateAiStatusCopy() {
  aiStatusCopy.innerHTML = settings.apiKey
    ? `AI polishing is connected with <strong>${escapeHtml(settings.model || "gpt-5-mini")}</strong>. Open <strong>AI Settings</strong> to update or remove the key.`
    : `Open <strong>AI Settings</strong> to connect your OpenAI API key when you want AI polishing.`;
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

  if (shouldScheduleSave) {
    schedulePersist();
  } else {
    persistSessions();
  }
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
                "You turn rough meeting notes into polished professional notes. Be concise, accurate, and businesslike. Do not invent facts. If details are missing, stay neutral. Preserve the language of the source notes. If the notes are Swedish, write Swedish. If the notes are English, write English.",
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
            },
            required: ["title", "summary", "highlights", "discussionPoints", "decisions", "actionItems"],
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
    "Return polished meeting notes in the requested schema.",
    "Requirements:",
    "- Use a professional tone.",
    `- Write the output in ${outputLanguage === OUTPUT_LANGUAGES.swedish ? "Swedish" : "English"}.`,
    "- Keep the summary to 3-5 sentences.",
    "- Keep action items specific.",
    "- Only include decisions that are actually supported by the notes.",
    "- Use discussion point headings that fit the meeting.",
  ].join("\n");
}

function buildAiOutputHtml(session, template, aiNotes, outputLanguage) {
  const sectionConfig = normalizeSectionConfig(session.sections);
  const copy = getOutputCopy(outputLanguage);
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
    return Array.isArray(parsed)
      ? parsed.map((session) => ({
          ...session,
          liveTranscript: session.liveTranscript ?? "",
          sections: normalizeSectionConfig(session.sections),
        }))
      : [];
  } catch {
    return [];
  }
}

function persistSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return { apiKey: "", model: "gpt-5-mini" };
    }

    return {
      apiKey: "",
      model: "gpt-5-mini",
      dictationLanguage: "auto",
      ...JSON.parse(stored),
    };
  } catch {
    return { apiKey: "", model: "gpt-5-mini", dictationLanguage: "auto" };
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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



