const AUTH_REQUIRED_TABS = new Set(["publish", "import"]);

export function isAuthRequiredForTab(tabKey) {
  return AUTH_REQUIRED_TABS.has(String(tabKey || "").trim());
}

export function collectOperationMessages(source) {
  const operationResult = source?.operationResult || source;
  const causes = Array.isArray(operationResult?.causes)
    ? operationResult.causes
    : [];

  const causeMessages = causes
    .map((cause) =>
      String(
        cause?.userMessage || cause?.message || cause?.key || "",
      ).trim(),
    )
    .filter(Boolean);

  if (causeMessages.length) {
    return causeMessages;
  }

  return [
    source?.message,
    operationResult?.message,
    operationResult?.rootCause?.userMessage,
    operationResult?.rootCause?.message,
  ]
    .map((message) => String(message || "").trim())
    .filter(Boolean);
}

export function buildChildOutcomeCards(result, labels = {}) {
  const childOutcomes =
    result?.childOutcomes && typeof result.childOutcomes === "object"
      ? result.childOutcomes
      : {};

  return Object.entries(labels)
    .filter(([key]) => childOutcomes[key] || (result?.[key] && typeof result[key] === "object"))
    .map(([key, label]) => {
      const outcome = childOutcomes[key] || result[key];
      return {
        key,
        label,
        ok: outcome?.ok !== false,
        message: String(
          outcome?.message || outcome?.userMessage || (outcome?.ok === false ? `${label}失败。` : `${label}已完成。`),
        ).trim(),
        causes: outcome?.ok === false ? collectOperationMessages(outcome) : [],
      };
    });
}

export function resolveThemePreviewPath(baseUrl, assetPath) {
  const normalizedBase = String(baseUrl || "./");
  const normalizedAsset = String(assetPath || "")
    .trim()
    .replace(/^\/+/, "");

  if (!normalizedAsset) {
    return "";
  }

  if (!normalizedBase || normalizedBase === "/") {
    return `/${normalizedAsset}`;
  }

  const baseWithSlash = normalizedBase.endsWith("/")
    ? normalizedBase
    : `${normalizedBase}/`;

  return `${baseWithSlash}${normalizedAsset}`;
}
