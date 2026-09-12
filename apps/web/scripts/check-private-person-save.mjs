#!/usr/bin/env node
// Keep every birth-data tool on the shared localized save flow. This is a
// source-level guard against reintroducing browser prompts or a one-off
// implementation that bypasses the private-person UX.
import { readFileSync } from "node:fs";

const root = new URL("../components/", import.meta.url);
const files = [
  "pancha-pakshi/BirthInputForm.tsx",
  "birth-chart/BirthChartClient.tsx",
  "dasha/DashaClient.tsx",
  "divisional-charts/DivisionalChartsClient.tsx",
  "birth-nakshatra/BirthNakshatraClient.tsx",
  "horoscope-report/HoroscopeReportClient.tsx",
  "porondam/PorondamClient.tsx",
];

const violations = [];
for (const relative of files) {
  const path = new URL(relative, root);
  const source = readFileSync(path, "utf8");
  if (!source.includes("PrivatePersonSaveButton")) {
    violations.push(`${relative}: missing PrivatePersonSaveButton`);
  }
  if (source.includes('window.prompt("Name for this person")')) {
    violations.push(`${relative}: contains the legacy browser prompt`);
  }
}

const picker = readFileSync(new URL("private-people/PrivatePersonPicker.tsx", root), "utf8");
if (!picker.includes("useId")) {
  violations.push("private-people/PrivatePersonPicker.tsx: picker ids must be unique per instance");
}
if (picker.includes(">Remove</button>")) {
  violations.push("private-people/PrivatePersonPicker.tsx: contains the untranslated remove action");
}

const saveButton = readFileSync(new URL("private-people/PrivatePersonSaveButton.tsx", root), "utf8");
if (!saveButton.includes("await onSave(trimmed);") || !saveButton.includes("resetForm();")) {
  violations.push("private-people/PrivatePersonSaveButton.tsx: successful saves must reset the form");
}

if (violations.length > 0) {
  console.error("Private-person save check FAILED:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("Private-person save check passed: all birth-data tools use the shared localized form.");
