import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const rootDir = process.cwd();
const appJsPath = path.join(rootDir, "app.js");
const indexHtmlPath = path.join(rootDir, "index.html");
const stylesPath = path.join(rootDir, "styles.css");

const appJsSource = fs.readFileSync(appJsPath, "utf8");
const indexHtmlSource = fs.readFileSync(indexHtmlPath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");

function extractConst(source, name) {
  const declaration = `const ${name} =`;
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error(`Could not find const ${name}`);
  }

  const equalsIndex = source.indexOf("=", start);
  const valueStart = source.indexOf("{", equalsIndex);
  let depth = 0;
  let end = -1;

  for (let index = valueStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Could not parse const ${name}`);
  }

  return source.slice(start, end + 2);
}

function extractFunction(source, name) {
  const declaration = `function ${name}(`;
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error(`Could not find function ${name}`);
  }

  const paramsStart = source.indexOf("(", start);
  let paramsDepth = 0;
  let bodyStart = -1;

  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramsDepth += 1;
    if (char === ")") {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        bodyStart = source.indexOf("{", index);
        break;
      }
    }
  }

  if (bodyStart === -1) {
    throw new Error(`Could not find function body for ${name}`);
  }

  let depth = 0;
  let end = -1;

  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Could not parse function ${name}`);
  }

  return source.slice(start, end + 1);
}

function loadPwaTemplateHelpers() {
  const snippets = [
    extractConst(appJsSource, "BUILT_IN_TEMPLATES"),
    extractConst(appJsSource, "TRANSCRIPTION_MODELS"),
    extractConst(appJsSource, "RELEVANT_TRANSCRIPTION_MODEL_IDS"),
    extractFunction(appJsSource, "getPreferredDesktopTemplateId"),
    extractFunction(appJsSource, "getVisibleTranscriptionModels"),
    extractFunction(appJsSource, "getTemplateBehaviorId"),
    extractFunction(appJsSource, "getTemplateTitleFieldLabel"),
    extractFunction(appJsSource, "formatIsoDate"),
    extractFunction(appJsSource, "formatIsoTime"),
    extractFunction(appJsSource, "formatDateTimeForTitle"),
    extractFunction(appJsSource, "getDefaultMeetingScheduleForTemplate"),
    extractFunction(appJsSource, "getDefaultTitleForTemplate"),
  ];

  const context = {};
  vm.createContext(context);
  const script = new vm.Script(`
    ${snippets.join("\n;\n")}
    ;globalThis.__exports = {
      BUILT_IN_TEMPLATES,
      TRANSCRIPTION_MODELS,
      RELEVANT_TRANSCRIPTION_MODEL_IDS,
      getPreferredDesktopTemplateId,
      getVisibleTranscriptionModels,
      getTemplateBehaviorId,
      getTemplateTitleFieldLabel,
      formatIsoDate,
      formatIsoTime,
      formatDateTimeForTitle,
      getDefaultMeetingScheduleForTemplate,
      getDefaultTitleForTemplate
    };
  `);
  script.runInContext(context);
  return context.__exports;
}

function loadPwaOutputVersionHelpers() {
  const snippets = [
    extractFunction(appJsSource, "createOutputVersionRecord"),
    extractFunction(appJsSource, "normalizeOutputVersionHistory"),
  ];

  let versionCounter = 0;
  const context = {
    crypto: {
      randomUUID: () => `version-${versionCounter += 1}`,
    },
  };
  vm.createContext(context);
  const script = new vm.Script(`
    ${snippets.join("\n;\n")}
    ;globalThis.__exports = {
      createOutputVersionRecord,
      normalizeOutputVersionHistory
    };
  `);
  script.runInContext(context);
  return context.__exports;
}

function loadPwaManualPolishHelpers() {
  const snippets = [
    extractFunction(appJsSource, "escapeRegExp"),
    extractFunction(appJsSource, "parseParticipants"),
    extractFunction(appJsSource, "normalizeParticipantDirectory"),
    extractFunction(appJsSource, "normalizeAbbreviationDirectory"),
    extractFunction(appJsSource, "expandKnownAbbreviations"),
    extractFunction(appJsSource, "canonicalizeParticipantMentions"),
    extractFunction(appJsSource, "standardizeRuleBasedDateAndTime"),
    extractFunction(appJsSource, "normalizeRuleBasedLabel"),
    extractFunction(appJsSource, "startsWithKnownParticipantAction"),
    extractFunction(appJsSource, "standardizeRuleBasedActionPattern"),
    extractFunction(appJsSource, "normalizeRuleBasedLinePunctuation"),
    extractFunction(appJsSource, "capitalizeSentenceStarts"),
    extractFunction(appJsSource, "ensureSentenceEnding"),
    extractFunction(appJsSource, "normalizeRuleBasedTextLine"),
    extractFunction(appJsSource, "polishNonAiNotesText"),
  ];

  const context = {
    settings: {
      abbreviationDirectory: [],
      participantDirectory: [],
    },
  };
  vm.createContext(context);
  const script = new vm.Script(`
    ${snippets.join("\n;\n")}
    ;globalThis.__exports = {
      polishNonAiNotesText
    };
  `);
  script.runInContext(context);
  return context.__exports;
}

function loadPwaRuleSuggestionHelpers() {
  const snippets = [
    extractFunction(appJsSource, "escapeRegExp"),
    extractFunction(appJsSource, "parseParticipants"),
    extractFunction(appJsSource, "normalizePreferredParticipantNames"),
    extractFunction(appJsSource, "normalizeRuleSuggestions"),
    extractConst(appJsSource, "SAFE_ABBREVIATION_SUGGESTIONS"),
    extractFunction(appJsSource, "hasMatchingRuleSuggestion"),
    extractFunction(appJsSource, "collectRuleSuggestionObservations"),
    extractFunction(appJsSource, "getVisibleRuleSuggestions"),
    extractFunction(appJsSource, "mergeRuleSuggestionObservations"),
  ];

  let uuidCounter = 0;
  const context = {
    settings: {
      abbreviationDirectory: [],
      preferredParticipantNames: [],
      ruleSuggestions: [],
    },
    persistSettings: () => {},
    crypto: {
      randomUUID: () => `suggestion-${uuidCounter += 1}`,
    },
    Date,
  };
  vm.createContext(context);
  const script = new vm.Script(`
    ${snippets.join("\n;\n")}
    ;globalThis.__exports = {
      collectRuleSuggestionObservations,
      mergeRuleSuggestionObservations
    };
  `);
  script.runInContext(context);
  return {
    ...context.__exports,
    context,
  };
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function normalizeVmObject(value) {
  return JSON.parse(JSON.stringify(value));
}

runTest("built-in session templates preserve intended defaults", () => {
  const { BUILT_IN_TEMPLATES, getPreferredDesktopTemplateId } = loadPwaTemplateHelpers();

  assert.ok(BUILT_IN_TEMPLATES.meeting);
  assert.ok(BUILT_IN_TEMPLATES.personalNote);
  assert.ok(BUILT_IN_TEMPLATES.oneToOneCall);

  assert.equal(BUILT_IN_TEMPLATES.meeting.fields.participants, true);
  assert.equal(BUILT_IN_TEMPLATES.meeting.fields.agenda, true);
  assert.equal(BUILT_IN_TEMPLATES.personalNote.fields.participants, true);
  assert.equal(BUILT_IN_TEMPLATES.personalNote.fields.meetingDate, true);
  assert.equal(BUILT_IN_TEMPLATES.personalNote.fields.meetingStartTime, true);
  assert.equal(BUILT_IN_TEMPLATES.personalNote.fields.meetingEndTime, false);
  assert.equal(BUILT_IN_TEMPLATES.oneToOneCall.fields.participants, true);
  assert.equal(BUILT_IN_TEMPLATES.oneToOneCall.fields.meetingDate, true);
  assert.equal(BUILT_IN_TEMPLATES.oneToOneCall.fields.meetingStartTime, true);
  assert.equal(BUILT_IN_TEMPLATES.oneToOneCall.fields.meetingEndTime, false);
  assert.equal(BUILT_IN_TEMPLATES.meeting.sections[0], "Overview");
  assert.equal(getPreferredDesktopTemplateId(), "meeting");
  assert.match(appJsSource, /selectedQuickTemplateId: "meeting"/);
  assert.match(indexHtmlSource, /id="include-agenda"/);
});

runTest("only relevant OpenAI transcription models are exposed in the selector", () => {
  const {
    TRANSCRIPTION_MODELS,
    RELEVANT_TRANSCRIPTION_MODEL_IDS,
    getVisibleTranscriptionModels,
  } = loadPwaTemplateHelpers();

  assert.deepEqual(
    normalizeVmObject(RELEVANT_TRANSCRIPTION_MODEL_IDS),
    ["gpt-transcribe", "gpt-4o-mini-transcribe", "gpt-4o-transcribe"]
  );
  assert.ok(TRANSCRIPTION_MODELS["gpt-transcribe"]);
  assert.ok(TRANSCRIPTION_MODELS["gpt-4o-mini-transcribe"]);
  assert.ok(TRANSCRIPTION_MODELS["gpt-4o-transcribe"]);
  assert.deepEqual(
    normalizeVmObject(getVisibleTranscriptionModels().map(([modelId]) => modelId)),
    ["gpt-transcribe", "gpt-4o-mini-transcribe", "gpt-4o-transcribe"]
  );
  assert.match(indexHtmlSource, /Only OpenAI transcription models relevant for this app are shown here/);
});

runTest("quick note and 1:1 templates auto-fill title and schedule defaults", () => {
  const {
    BUILT_IN_TEMPLATES,
    getDefaultMeetingScheduleForTemplate,
    getDefaultTitleForTemplate,
  } = loadPwaTemplateHelpers();

  const timestamp = new Date("2026-04-10T14:35:00").getTime();

  assert.equal(getDefaultTitleForTemplate(BUILT_IN_TEMPLATES.personalNote, timestamp), "2026-04-10 14:35");
  assert.equal(getDefaultTitleForTemplate(BUILT_IN_TEMPLATES.oneToOneCall, timestamp), "2026-04-10 14:35");
  assert.equal(getDefaultTitleForTemplate(BUILT_IN_TEMPLATES.meeting, timestamp), "");

  assert.deepEqual(
    normalizeVmObject(getDefaultMeetingScheduleForTemplate(BUILT_IN_TEMPLATES.personalNote, timestamp)),
    { meetingDate: "2026-04-10", meetingStartTime: "14:35", meetingEndTime: "" }
  );
  assert.deepEqual(
    normalizeVmObject(getDefaultMeetingScheduleForTemplate(BUILT_IN_TEMPLATES.oneToOneCall, timestamp)),
    { meetingDate: "2026-04-10", meetingStartTime: "14:35", meetingEndTime: "" }
  );
  assert.deepEqual(
    normalizeVmObject(getDefaultMeetingScheduleForTemplate(BUILT_IN_TEMPLATES.meeting, timestamp)),
    { meetingDate: "", meetingStartTime: "", meetingEndTime: "" }
  );
});

runTest("title labels stay aligned with built-in and derived template behavior", () => {
  const {
    BUILT_IN_TEMPLATES,
    getTemplateTitleFieldLabel,
  } = loadPwaTemplateHelpers();

  assert.equal(getTemplateTitleFieldLabel(BUILT_IN_TEMPLATES.meeting), "Meeting title");
  assert.equal(getTemplateTitleFieldLabel(BUILT_IN_TEMPLATES.personalNote), "Quick note title");
  assert.equal(getTemplateTitleFieldLabel(BUILT_IN_TEMPLATES.oneToOneCall), "1:1 / Phone call title");
  assert.equal(
    getTemplateTitleFieldLabel({
      id: "custom-quick-note",
      sourceTemplateId: "personalNote",
      label: "Field note",
    }),
    "Quick note title"
  );
});

runTest("capture shell keeps the core minimal defaults visible in markup", () => {
  assert.match(indexHtmlSource, /<p class="section-label">Details<\/p>/);
  assert.match(indexHtmlSource, /<summary>People<\/summary>/);
  assert.match(indexHtmlSource, /id="manual-notes-disclosure" open/);
  assert.match(indexHtmlSource, /Write your own notes here, which will be included in the Output/);
  assert.match(indexHtmlSource, /id="live-transcript-disclosure" hidden/);
  assert.match(indexHtmlSource, /id="uploaded-transcript-disclosure" hidden/);
  assert.match(indexHtmlSource, /<summary>Transcript<\/summary>/);
  assert.match(indexHtmlSource, /Paste a transcript here, or upload one from a file\./);
  assert.doesNotMatch(indexHtmlSource, /Optional emphasis/);
  assert.doesNotMatch(indexHtmlSource, /Work from notes, transcript, or both/);
  assert.doesNotMatch(indexHtmlSource, /Imported text/);
});

runTest("detailed guidance moved into the Instructions modal instead of the capture sidebar", () => {
  const sidebarMatch = indexHtmlSource.match(/<aside class="editor-sidebar">([\s\S]*?)<\/aside>/);
  const instructionsMatch = indexHtmlSource.match(/<div class="modal-shell is-hidden" id="instructions-modal"[\s\S]*?<\/div>\s*<\/div>/);

  assert.ok(sidebarMatch);
  assert.ok(instructionsMatch);
  assert.match(indexHtmlSource, /id="open-instructions"/);
  assert.match(indexHtmlSource, /id="mobile-open-instructions"/);

  assert.doesNotMatch(sidebarMatch[1], /No capture saved yet/);
  assert.doesNotMatch(sidebarMatch[1], /Dictation uses the browser speech API when available/);
  assert.doesNotMatch(sidebarMatch[1], /Allow while visiting the site/);
  assert.doesNotMatch(sidebarMatch[1], /Open <strong>Settings → AI<\/strong> to connect your OpenAI API key when you want AI polishing/);

  assert.match(instructionsMatch[0], /How to use the Sessions app/);
  assert.match(instructionsMatch[0], /Choose the right recording mode/);
  assert.match(instructionsMatch[0], /Technical design/);
  assert.match(instructionsMatch[0], /IndexedDB/);
  assert.match(instructionsMatch[0], /getUserMedia/);
});

runTest("recording management is no longer embedded in the main capture sidebar", () => {
  const sidebarMatch = indexHtmlSource.match(/<aside class="editor-sidebar">([\s\S]*?)<\/aside>/);
  const recordingsModalMatch = indexHtmlSource.match(/<div class="modal-shell is-hidden" id="recordings-modal"[\s\S]*?<\/div>\s*<\/div>/);

  assert.ok(sidebarMatch);
  assert.ok(recordingsModalMatch);
  assert.match(indexHtmlSource, /id="manage-recordings"/);
  assert.doesNotMatch(sidebarMatch[1], /Saved recordings/);
  assert.doesNotMatch(sidebarMatch[1], /Delete recordings you no longer need before transcription/);
  assert.match(recordingsModalMatch[0], /Saved recordings/);
  assert.match(recordingsModalMatch[0], /ready for transcription/);
});

runTest("top chrome hosts the save-status pill instead of the right sidebar", () => {
  const topActionsMatch = indexHtmlSource.match(/<div class="panel-actions-shared desktop-only">([\s\S]*?)<\/div>/);
  assert.ok(topActionsMatch);
  assert.match(topActionsMatch[1], /id="save-status"/);

  const sidebarPrefix = indexHtmlSource.split('<aside class="editor-sidebar">')[1] ?? "";
  const earlySidebarSlice = sidebarPrefix.slice(0, 400);
  assert.doesNotMatch(earlySidebarSlice, /id="save-status"/);
});

runTest("theme families have distinct light and dark background treatments", () => {
  const themeFamilies = ["fluent-slate", "atlas-blue", "nordic-teal", "graphite-forest", "stone-olive", "copper-ink"];
  themeFamilies.forEach((family) => {
    assert.match(stylesSource, new RegExp(`:root\\[data-theme="${family}-light"\\] body \\{[\\s\\S]*?linear-gradient`, "m"));
    assert.match(stylesSource, new RegExp(`:root\\[data-theme="${family}-dark"\\] body \\{[\\s\\S]*?linear-gradient`, "m"));
    assert.match(indexHtmlSource, new RegExp(`<option value="${family}">`));
  });
});

runTest("capture and output divider supports symmetric narrow panels", () => {
  assert.match(appJsSource, /const MIN_WORKSPACE_PANEL_WIDTH = 260/);
  assert.match(stylesSource, /--workspace-panel-min-width: 260px/);
  assert.match(stylesSource, /\.editor-panel \{[\s\S]*?container-type: inline-size;/);
  assert.match(stylesSource, /@container \(max-width: 620px\) \{[\s\S]*?\.editor-layout \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
});

runTest("agenda rich-text input does not rewrite itself on every keystroke", () => {
  assert.match(appJsSource, /meetingAgendaInput\.addEventListener\("input", \(\) => \{[\s\S]*?updateActiveSession\(\{ agenda: richTextValue \}, true\);[\s\S]*?\}\);/);
  assert.doesNotMatch(appJsSource, /meetingAgendaInput\.addEventListener\("input", \(\) => \{[\s\S]*?setRichTextContent\(meetingAgendaInput, richTextValue\);[\s\S]*?\}\);/);
  assert.match(appJsSource, /meetingAgendaInput\.addEventListener\("blur", \(\) => \{[\s\S]*?setRichTextContent\(meetingAgendaInput, getRichTextContent\(meetingAgendaInput\)\);[\s\S]*?\}\);/);
});

runTest("OpenAI rate-limit errors include actionable guidance", () => {
  assert.match(appJsSource, /response\.status === 429/);
  assert.match(appJsSource, /temporary OpenAI rate limit/);
  assert.match(appJsSource, /Check your OpenAI billing, usage tier, or project spend limits/);
  assert.match(appJsSource, /choose a lighter model in AI Settings/);
});

runTest("generated output versions are normalized into a reusable history", () => {
  const { normalizeOutputVersionHistory } = loadPwaOutputVersionHelpers();
  const history = normalizeVmObject(
    normalizeOutputVersionHistory([], "<p>Current version</p>", "<p>Previous version</p>", 1200)
  );

  assert.equal(history.length, 2);
  assert.equal(history[0].html, "<p>Current version</p>");
  assert.equal(history[0].generatedAt, 1200);
  assert.equal(history[1].html, "<p>Previous version</p>");
  assert.equal(history[1].generatedAt, 1199);
  assert.match(indexHtmlSource, /id="output-versions-disclosure"/);
  assert.match(indexHtmlSource, /Version history/);
});

runTest("quick-start strip creates sessions directly and keeps the split meeting capture wording", () => {
  assert.match(appJsSource, /const preferredOrder = \["meeting", "personalNote", "oneToOneCall"\]/);
  assert.match(appJsSource, /button\.textContent = `New \$\{template\.label\}`/);
  assert.match(appJsSource, /createAndOpenNewSession\(template\.id\)/);
  assert.match(appJsSource, /contextCardDisclosure\.open = nextSession\.template === "meeting"/);
  assert.match(indexHtmlSource, /id="audio-record-toggle"[\s\S]*?Start room \/ hybrid meeting[\s\S]*?Use mic for room voices and nearby speakers/);
  assert.match(indexHtmlSource, /id="audio-screen-toggle"[\s\S]*?Start screen \/ browser audio[\s\S]*?Use direct in-computer audio from a tab or screen/);
  assert.match(indexHtmlSource, /id="dictation-toggle"[\s\S]*?Start dictation[\s\S]*?Best for personal dictation/);
});

runTest("output panel places actions before the polished document and removes empty disclosures", () => {
  const headingIndex = indexHtmlSource.indexOf('<p class="section-label">Output</p>');
  const actionsIndex = indexHtmlSource.indexOf('id="export-word"');
  const sidebarIndex = indexHtmlSource.indexOf('<aside class="output-sidebar">');
  const mainIndex = indexHtmlSource.indexOf('<div class="output-main">');
  assert.ok(headingIndex >= 0);
  assert.ok(actionsIndex >= 0);
  assert.ok(sidebarIndex >= 0);
  assert.ok(mainIndex >= 0);
  assert.ok(headingIndex < actionsIndex);
  assert.ok(sidebarIndex < mainIndex);
  assert.doesNotMatch(indexHtmlSource, /More output options/);
  assert.match(indexHtmlSource, /<p class="section-label">Output<\/p>/);
  assert.doesNotMatch(indexHtmlSource, /<h2>Output<\/h2>/);
  assert.match(indexHtmlSource, /Add notes or transcript in the Capture section to the left, include highlights if useful, then click <strong>Generate<\/strong>\./);
});

runTest("generation mode uses explicit manual-vs-AI choices instead of transcript-only", () => {
  assert.match(indexHtmlSource, /id="generation-mode-manual"/);
  assert.match(indexHtmlSource, /Polish Manual notes without AI/);
  assert.match(indexHtmlSource, /id="generation-mode-ai"/);
  assert.match(indexHtmlSource, /Generate with AI/);
  assert.doesNotMatch(indexHtmlSource, /Transcribe only/);
  assert.match(appJsSource, /Manual notes were transferred to Output without AI generation\./);
});

runTest("non-AI polishing expands abbreviations, canonicalizes participants, and cleans prose", () => {
  const { polishNonAiNotesText } = loadPwaManualPolishHelpers();
  const polished = polishNonAiNotesText(
    ["teh mtg with ola moved to 9.30", "and the adress was updated"].join("\n"),
    {
      participantsValue: "Ola Jeppsson, Anna Smith",
      abbreviationDirectory: [{ short: "mtg", full: "meeting" }],
    }
  );

  assert.equal(polished, "The meeting with Ola Jeppsson moved to 09:30 and the address was updated.");
});

runTest("non-AI polishing does not turn ordinary rough prose into an action item", () => {
  const { polishNonAiNotesText } = loadPwaManualPolishHelpers();
  const polished = polishNonAiNotesText("Tesing to write asom notes whn many mistakens\nmtg booked 3/4", {
    participantsValue: "",
    abbreviationDirectory: [],
  });

  assert.equal(polished, "Testing to write some notes when many mistakes meeting booked 3/4.");
});

runTest("suggested rules require repeated evidence and avoid ambiguous participant-name mappings", () => {
  const { collectRuleSuggestionObservations, mergeRuleSuggestionObservations, context } = loadPwaRuleSuggestionHelpers();

  const observations = normalizeVmObject(
    collectRuleSuggestionObservations(
      { id: "session-1", participants: "Ola Jeppsson, Anna Smith" },
      "mtg with Ola moved to next week",
    ),
  );

  assert.ok(observations.some((entry) => entry.type === "abbreviation" && entry.sourceValue === "mtg" && entry.suggestedValue === "meeting"));
  assert.ok(observations.some((entry) => entry.type === "preferred_name" && entry.sourceValue === "Ola" && entry.suggestedValue === "Ola Jeppsson"));

  const firstVisible = normalizeVmObject(mergeRuleSuggestionObservations("session-1", observations));
  assert.equal(firstVisible.length, 0);

  const secondVisible = normalizeVmObject(mergeRuleSuggestionObservations("session-2", observations));
  assert.ok(secondVisible.some((entry) => entry.type === "abbreviation" && entry.evidenceCount >= 2));
  assert.ok(secondVisible.some((entry) => entry.type === "preferred_name" && entry.evidenceCount >= 2));

  context.settings.ruleSuggestions = [];
  const ambiguous = normalizeVmObject(
    collectRuleSuggestionObservations(
      { id: "session-3", participants: "Ann Smith, Ann Jones" },
      "Ann will follow up",
    ),
  );
  assert.equal(ambiguous.some((entry) => entry.type === "preferred_name"), false);
});

runTest("suggested-rule surfaces are present in PWA output and settings", () => {
  assert.match(indexHtmlSource, /id="rule-suggestions-panel"/);
  assert.match(indexHtmlSource, /id="abbreviation-suggestion-list"/);
  assert.match(indexHtmlSource, /id="preferred-participant-name-list"/);
  assert.match(indexHtmlSource, /id="participant-suggestion-list"/);
});

runTest("pwa keeps suggested-rule refresh attached to generation and revision flows", () => {
  assert.match(appJsSource, /renderOutput\(\);\s*refreshRuleSuggestionsForSession\(getActiveSession\(\)\);\s*const addedParticipants = await maybeOfferParticipantDirectoryUpdate/);
  assert.match(appJsSource, /renderOutput\(\);\s*refreshRuleSuggestionsForSession\(getActiveSession\(\)\);\s*if \(isMobileLayout\(\)\) \{/);
});

runTest("pwa backup export is a full backup and import restores settings plus sessions", () => {
  assert.match(appJsSource, /function buildSharedDataPayload\(\) \{[\s\S]*?sessions,[\s\S]*?settings:\s*\{[\s\S]*?\.\.\.settings,/);
  assert.match(appJsSource, /storageMode: STORAGE_MODES\.browser/);
  assert.match(appJsSource, /async function exportSessions\(\) \{[\s\S]*?buildSharedDataPayload\(\)/);
  assert.match(appJsSource, /createSingleJsonZip\(JSON\.stringify\(payload, null, 2\)\)/);
  assert.match(appJsSource, /meeting-notes-backup-/);
  assert.match(appJsSource, /async function importSessionsFromFile\(event\) \{[\s\S]*?readBackupFileText\(file\)[\s\S]*?applySharedDataPayload/);
  assert.match(appJsSource, /persistSettings\(\);/);
  assert.match(indexHtmlSource, /accept="application\/json,application\/zip,\.json,\.zip"/);
});

console.log("PWA core tests passed.");
