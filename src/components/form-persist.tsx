"use client";

import { useEffect } from "react";

type FormPersistProps = {
  formId: string;
  storageKey: string;
  restoreOnMount: boolean;
  excludeNames?: string[];
};

type PersistedValue = string | boolean | string[];
type PersistedRecord = Record<string, PersistedValue>;

function readFormValues(form: HTMLFormElement, excludeNames: Set<string>): PersistedRecord {
  const values: PersistedRecord = {};
  const elements = Array.from(form.elements);

  for (const element of elements) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      continue;
    }

    const name = element.name?.trim();
    if (!name || element.disabled || excludeNames.has(name)) {
      continue;
    }

    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox") {
        values[name] = element.checked;
        continue;
      }
      if (element.type === "radio") {
        if (element.checked) values[name] = element.value;
        continue;
      }
    }

    if (element instanceof HTMLSelectElement && element.multiple) {
      values[name] = Array.from(element.selectedOptions).map((option) => option.value);
      continue;
    }

    values[name] = element.value;
  }

  return values;
}

function writeFormValues(form: HTMLFormElement, values: PersistedRecord) {
  const elements = Array.from(form.elements);

  for (const element of elements) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      continue;
    }

    const name = element.name?.trim();
    if (!name) continue;
    const value = values[name];
    if (value === undefined) continue;

    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox") {
        element.checked = Boolean(value);
        continue;
      }
      if (element.type === "radio") {
        element.checked = String(value) === element.value;
        continue;
      }
    }

    if (element instanceof HTMLSelectElement && element.multiple && Array.isArray(value)) {
      const selected = new Set(value.map(String));
      for (const option of Array.from(element.options)) {
        option.selected = selected.has(option.value);
      }
      continue;
    }

    element.value = String(value);
  }
}

export function FormPersist({
  formId,
  storageKey,
  restoreOnMount,
  excludeNames = [],
}: FormPersistProps) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const excludeSet = new Set(excludeNames);

    if (restoreOnMount) {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PersistedRecord;
          writeFormValues(form, parsed);
        } catch {
          window.sessionStorage.removeItem(storageKey);
        }
      }
    } else {
      window.sessionStorage.removeItem(storageKey);
    }

    const onSubmit = () => {
      const payload = readFormValues(form, excludeSet);
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    };

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [excludeNames, formId, restoreOnMount, storageKey]);

  return null;
}
