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
  assert.equal(BUILT_IN_TEMPLATES.personalNote.fields.participants, false);
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
    ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gpt-4o-transcribe-diarize"]
  );
  assert.ok(TRANSCRIPTION_MODELS["gpt-4o-mini-transcribe"]);
  assert.ok(TRANSCRIPTION_MODELS["gpt-4o-transcribe"]);
  assert.ok(TRANSCRIPTION_MODELS["gpt-4o-transcribe-diarize"]);
  assert.deepEqual(
    normalizeVmObject(getVisibleTranscriptionModels().map(([modelId]) => modelId)),
    ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gpt-4o-transcribe-diarize"]
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

console.log("PWA core tests passed.");
