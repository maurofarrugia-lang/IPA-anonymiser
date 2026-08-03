# Security Policy

## EUAA Monitoring Anonymiser

### Scope

This is a **static, client-side only** web application. There is no server component, no database, and no API endpoint that accepts user data.

### Security model

| Concern | Mitigation |
|---|---|
| Data exfiltration | All processing runs in the browser via JavaScript. No `fetch()` or `XMLHttpRequest` calls are made with document content. |
| Stored data | Nothing is written to `localStorage`, `sessionStorage`, `IndexedDB`, or cookies. |
| Supply chain | All CDN libraries are loaded from jsDelivr with pinned version numbers. |
| Redaction permanence | Black-bar PDF redaction uses opaque filled rectangles drawn over the original content layer. The underlying text layer in the original PDF is not removed — use "Anonymise & rebuild" mode if you need the text itself replaced. |

### Limitations

- This tool performs **rule-based anonymisation** using pattern matching and heuristics. It does not use AI/NLP models.
- It may miss names or identifiers not covered by its detection patterns.
- **It does not constitute certified legal redaction.**
- Always perform a manual review of anonymised output before external use.

### Reporting issues

If you discover a privacy or security issue, please open a GitHub Issue marked **[SECURITY]** or contact the repository maintainer directly.
