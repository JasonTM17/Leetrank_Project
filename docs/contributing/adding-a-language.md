# How to add a language to the judge

The judge language manifest is the single source of truth. Adding a language is a 7-step change across four files. All four must land in the same PR.

---

## Overview of files to change

| File | What changes |
| --- | --- |
| `judge-service/languages.json` | New language entry |
| `judge-service/Dockerfile` | Toolchain installation |
| `judge-service/main.go` | `dangerousPatterns` blocklist |
| `src/lib/languages.ts` | Frontend `LanguageDef` entry |
| `src/__tests__/languages.test.ts` | Sorted-ID assertion |
| `judge-service/README.md` | Language table |

---

## Step 1 — Append an entry to `judge-service/languages.json`

The file is the canonical manifest. The `$comment` at the top of the file explains the placeholder semantics.

**Interpreted language example:**

```json
{
  "id": "mylang",
  "label": "MyLang",
  "extension": ".ml",
  "monacoLanguage": "plaintext",
  "kind": "interpreted",
  "runCmd": ["mylang", "{src}"],
  "category": "scripting"
}
```

**Compiled language example:**

```json
{
  "id": "mylang",
  "label": "MyLang",
  "extension": ".ml",
  "monacoLanguage": "plaintext",
  "kind": "compiled",
  "compileCmd": ["mlc", "-o", "{bin}", "{src}"],
  "runCmd": ["{bin}"],
  "category": "compiled"
}
```

Placeholders:

| Placeholder | Expands to |
| --- | --- |
| `{src}` | Absolute path to the submitted source file |
| `{bin}` | Absolute path for the compiled output binary |
| `{workdir}` | Temporary working directory for the submission |

Valid `category` values: `scripting`, `compiled`, `jvm`, `functional`, `data`, `esoteric`.

---

## Step 2 — Install the toolchain in `judge-service/Dockerfile`

Add an `apt-get install` line in the toolchain installation block. Keep the list alphabetically sorted within its group.

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    # ... existing packages ...
    mylang-runtime \
    && rm -rf /var/lib/apt/lists/*
```

If the toolchain is not in the Debian package registry, add a `RUN curl | tar` or `RUN wget` step following the pattern used for Kotlin or Scala in the same Dockerfile.

---

## Step 3 — Add `dangerousPatterns` to `judge-service/main.go`

Every language must have a blocklist entry. Fail closed: if a pattern is unknown, the submission is rejected.

Find the `dangerousPatterns` map in `main.go` and add an entry:

```go
"mylang": {
    `import\s+os`,
    `import\s+subprocess`,
    `exec\s*\(`,
    `open\s*\(`,
    // add any language-specific dangerous constructs
},
```

For languages with no meaningful dangerous patterns (e.g. SQL running against an in-memory database), add an empty slice with a comment explaining why:

```go
"sql": {}, // sqlite3 :memory: — no filesystem or network access possible
```

---

## Step 4 — Add a `LanguageDef` to `src/lib/languages.ts`

The frontend mirrors `languages.json`. Add an entry in the correct category block:

```ts
// src/lib/languages.ts
{ id: "mylang", label: "MyLang", extension: ".ml", monacoLanguage: "plaintext", category: "scripting" },
```

The `id` must exactly match the `id` in `languages.json`. The `monacoLanguage` value must be a valid Monaco language identifier; use `"plaintext"` if Monaco does not support the language.

---

## Step 5 — Update `src/__tests__/languages.test.ts`

The test file contains a sorted-ID assertion that verifies `LANGUAGE_IDS` is in alphabetical order within each category. Add the new ID to the expected list in the correct position.

---

## Step 6 — Update `judge-service/README.md`

Add a row to the supported languages table:

```markdown
| `mylang` | MyLang | interpreted | `mylang` |
```

---

## Step 7 — Build and smoke-test locally

```bash
# Rebuild the judge image
docker build -t leetrank-judge:local ./judge-service

# Run a hello-world submission against the local image
docker run --rm leetrank-judge:local \
  /bin/sh -c 'echo "print(\"hello\")" > /tmp/test.ml && mylang /tmp/test.ml'
```

The output must be `hello`. If the toolchain is not on PATH or the runner fails, fix the Dockerfile before opening a PR.

---

*LeetRank — a learning project by Nguyễn Sơn (jasonbmt06@gmail.com). Feedback and questions welcome via email or [GitHub Issues](https://github.com/JasonTM17/LeetRank_Project/issues).*
