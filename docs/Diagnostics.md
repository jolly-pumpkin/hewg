# Diagnostics

Every diagnostic emitted by `hewg` has a stable code. Codes are grouped by
topic (ingest, annotation syntax, effects, capabilities, contracts,
warnings), but topic and severity are independent — a code in the `E0301–`
range may still carry `warning` severity.

## Severity legend

| Severity | Meaning |
|---|---|
| `error` | build-breaking; `hewg check` exits 1 |
| `warning` | advisory; does not affect exit code |
| `info` | observational |
| `help` | fix-it hint attached to another diagnostic |

## Catalog

| Code | Severity | Category | Summary |
|---|---|---|---|
| [`E0001`](#e0001) | error | ingest | tsconfig not found |
| [`E0002`](#e0002) | error | ingest | file read error |
| [`E0003`](#e0003) | error | lookup | symbol not found |
| [`E0004`](#e0004) | error | lookup | ambiguous symbol reference |
| [`E0201`](#e0201) | error | annotation-syntax | malformed annotation tag |
| [`E0202`](#e0202) | error | annotation-syntax | @cap references non-existent parameter |
| [`E0301`](#e0301) | error | effect | effect not declared in @effects |
| [`E0302`](#e0302) | warning | effect | declared effect never used |
| [`E0303`](#e0303) | error | effect | effect row widening in override |
| [`E0401`](#e0401) | error | capability | capability scope mismatch |
| [`E0402`](#e0402) | error | capability | missing capability at call site |
| [`E0403`](#e0403) | error | capability | capability passed as wrong parameter name |
| [`E0501`](#e0501) | error | contract | malformed @pre/@post/@cost expression |
| [`I0001`](#i0001) | info | contract | symbol has no Hewg annotations |
| [`W0001`](#w0001) | warning | warning | unknown @cost field |
| [`W0002`](#w0002) | warning | warning | unknown @hewg-* tag |

## E0001 — tsconfig not found

- Severity: `error`
- Category: `ingest`
- Docs: https://hewg.dev/e/E0001

### Human

```
error[E0001]: no tsconfig.json found at or above the current directory
  --> .:1:1
  = note: run `hewg check` from a directory containing a tsconfig.json, or pass --project <path>
  = help: https://hewg.dev/e/E0001
```

### JSON

```json
{"code":"E0001","severity":"error","file":".","line":1,"col":1,"len":1,"message":"no tsconfig.json found at or above the current directory","notes":[{"message":"run `hewg check` from a directory containing a tsconfig.json, or pass --project <path>"}],"docs":"https://hewg.dev/e/E0001"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0001",
  "level": "error",
  "message": {
    "text": "no tsconfig.json found at or above the current directory"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "."
        },
        "region": {
          "startLine": 1,
          "startColumn": 1,
          "endLine": 1,
          "endColumn": 2
        }
      }
    }
  ]
}
```

## E0002 — file read error

- Severity: `error`
- Category: `ingest`
- Docs: https://hewg.dev/e/E0002

### Human

```
error[E0002]: could not read file: EACCES
  --> src/payments/refund.ts:1:1
  |
1 | /**
  | ^
  |
  = help: https://hewg.dev/e/E0002
```

### JSON

```json
{"code":"E0002","severity":"error","file":"src/payments/refund.ts","line":1,"col":1,"len":1,"message":"could not read file: EACCES","docs":"https://hewg.dev/e/E0002"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0002",
  "level": "error",
  "message": {
    "text": "could not read file: EACCES"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 1,
          "startColumn": 1,
          "endLine": 1,
          "endColumn": 2
        }
      }
    }
  ]
}
```

## E0003 — symbol not found

- Severity: `error`
- Category: `lookup`
- Docs: https://hewg.dev/e/E0003

### Human

```
error[E0003]: symbol `payments/refund::refnud` not found
  --> -:1:1
help: did you mean `refund`?
  | + payments/refund::refund
  = help: https://hewg.dev/e/E0003
```

### JSON

```json
{"code":"E0003","severity":"error","file":"-","line":1,"col":1,"len":1,"message":"symbol `payments/refund::refnud` not found","suggest":[{"kind":"rename-arg","rationale":"did you mean `refund`?","at":{"file":"-","line":1,"col":1,"len":1},"insert":"payments/refund::refund"}],"docs":"https://hewg.dev/e/E0003"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0003",
  "level": "error",
  "message": {
    "text": "symbol `payments/refund::refnud` not found"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "-"
        },
        "region": {
          "startLine": 1,
          "startColumn": 1,
          "endLine": 1,
          "endColumn": 2
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "did you mean `refund`?"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "-"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 1,
                "startColumn": 1,
                "endLine": 1,
                "endColumn": 2
              },
              "insertedContent": {
                "text": "payments/refund::refund"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0004 — ambiguous symbol reference

- Severity: `error`
- Category: `lookup`
- Docs: https://hewg.dev/e/E0004

### Human

```
error[E0004]: symbol `refund` is ambiguous (2 matches)
  --> -:1:1
note: candidate: payments/refund::refund
  --> src/payments/refund.ts:11:1
   |
11 | export async function refund(http: HttpClient, amountCents: number) {
   | ^^^^^^
note: candidate: audit/refund::refund
  --> src/audit/refund.ts:8:1
  = help: https://hewg.dev/e/E0004
```

### JSON

```json
{"code":"E0004","severity":"error","file":"-","line":1,"col":1,"len":1,"message":"symbol `refund` is ambiguous (2 matches)","related":[{"file":"src/payments/refund.ts","line":11,"col":1,"len":6,"message":"candidate: payments/refund::refund"},{"file":"src/audit/refund.ts","line":8,"col":1,"len":6,"message":"candidate: audit/refund::refund"}],"docs":"https://hewg.dev/e/E0004"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0004",
  "level": "error",
  "message": {
    "text": "symbol `refund` is ambiguous (2 matches)"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "-"
        },
        "region": {
          "startLine": 1,
          "startColumn": 1,
          "endLine": 1,
          "endColumn": 2
        }
      }
    }
  ],
  "relatedLocations": [
    {
      "id": 0,
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 11,
          "startColumn": 1,
          "endLine": 11,
          "endColumn": 7
        }
      },
      "message": {
        "text": "candidate: payments/refund::refund"
      }
    },
    {
      "id": 1,
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/audit/refund.ts"
        },
        "region": {
          "startLine": 8,
          "startColumn": 1,
          "endLine": 8,
          "endColumn": 7
        }
      },
      "message": {
        "text": "candidate: audit/refund::refund"
      }
    }
  ]
}
```

## E0201 — malformed annotation tag

- Severity: `error`
- Category: `annotation-syntax`
- Docs: https://hewg.dev/e/E0201

### Human

```
error[E0201]: malformed @effects tag: expected comma-separated effect names
  --> src/payments/refund.ts:3:4
  |
3 |  * @effects    net.https fs.write
  |    ^^^^^^^^^^^^^^^^^^^^
  |
help: separate effect names with commas
  |
3 |  * @effects    net.https fs.write
  |              ~ net.https, fs.write
  = help: https://hewg.dev/e/E0201
```

### JSON

```json
{"code":"E0201","severity":"error","file":"src/payments/refund.ts","line":3,"col":4,"len":20,"message":"malformed @effects tag: expected comma-separated effect names","suggest":[{"kind":"fix-syntax","rationale":"separate effect names with commas","at":{"file":"src/payments/refund.ts","line":3,"col":14,"len":10},"insert":"net.https, fs.write"}],"docs":"https://hewg.dev/e/E0201"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0201",
  "level": "error",
  "message": {
    "text": "malformed @effects tag: expected comma-separated effect names"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 3,
          "startColumn": 4,
          "endLine": 3,
          "endColumn": 24
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "separate effect names with commas"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 3,
                "startColumn": 14,
                "endLine": 3,
                "endColumn": 24
              },
              "insertedContent": {
                "text": "net.https, fs.write"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0202 — @cap references non-existent parameter

- Severity: `error`
- Category: `annotation-syntax`
- Docs: https://hewg.dev/e/E0202

### Human

```
error[E0202]: @cap references parameter `htpp` which does not exist on this function
  --> src/payments/refund.ts:4:9
  |
4 |  * @cap htpp net.https host="api.stripe.com"
  |         ^^^^
  |
note: did you mean `http`?
  --> src/payments/refund.ts:11:30
   |
11 | export async function refund(http: HttpClient, amountCents: number) {
   |                              ^^^^
help: rename the @cap parameter to match the function signature
  |
4 |  * @cap htpp net.https host="api.stripe.com"
  |         ~ http
  = help: https://hewg.dev/e/E0202
```

### JSON

```json
{"code":"E0202","severity":"error","file":"src/payments/refund.ts","line":4,"col":9,"len":4,"message":"@cap references parameter `htpp` which does not exist on this function","related":[{"file":"src/payments/refund.ts","line":11,"col":30,"len":4,"message":"did you mean `http`?"}],"suggest":[{"kind":"rename-arg","rationale":"rename the @cap parameter to match the function signature","at":{"file":"src/payments/refund.ts","line":4,"col":9,"len":4},"insert":"http"}],"docs":"https://hewg.dev/e/E0202"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0202",
  "level": "error",
  "message": {
    "text": "@cap references parameter `htpp` which does not exist on this function"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 4,
          "startColumn": 9,
          "endLine": 4,
          "endColumn": 13
        }
      }
    }
  ],
  "relatedLocations": [
    {
      "id": 0,
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 11,
          "startColumn": 30,
          "endLine": 11,
          "endColumn": 34
        }
      },
      "message": {
        "text": "did you mean `http`?"
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "rename the @cap parameter to match the function signature"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 4,
                "startColumn": 9,
                "endLine": 4,
                "endColumn": 13
              },
              "insertedContent": {
                "text": "http"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0301 — effect not declared in @effects

- Severity: `error`
- Category: `effect`
- Docs: https://hewg.dev/e/E0301

### Human

```
error[E0301]: call to `fs.readFile` performs effect `fs.read`, not declared in @effects `log`
  --> src/audit.ts:6:23
  |
6 |    const data = await fs.readFile(path); return data;
  |                       ^^^^^^^^^^^
  |
note: effect row declared here
  --> src/audit.ts:2:13
  |
2 |  * @effects log
  |             ^^^
help: declare the effect
  |
2 |  * @effects log
  |                + , fs.read
help: thread an Fs.Read capability from the caller
  |
3 |  * @cap log log
  | +  * @cap fs fs.read prefix="./receipts/"⏎
  = help: https://hewg.dev/e/E0301
```

### JSON

```json
{"code":"E0301","severity":"error","file":"src/audit.ts","line":6,"col":23,"len":11,"message":"call to `fs.readFile` performs effect `fs.read`, not declared in @effects `log`","related":[{"file":"src/audit.ts","line":2,"col":13,"len":3,"message":"effect row declared here"}],"suggest":[{"kind":"add-effect","rationale":"declare the effect","at":{"file":"src/audit.ts","line":2,"col":16,"len":0},"insert":", fs.read"},{"kind":"add-cap","rationale":"thread an Fs.Read capability from the caller","at":{"file":"src/audit.ts","line":3,"col":1,"len":0},"insert":" * @cap fs fs.read prefix=\"./receipts/\"\n"}],"docs":"https://hewg.dev/e/E0301"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0301",
  "level": "error",
  "message": {
    "text": "call to `fs.readFile` performs effect `fs.read`, not declared in @effects `log`"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/audit.ts"
        },
        "region": {
          "startLine": 6,
          "startColumn": 23,
          "endLine": 6,
          "endColumn": 34
        }
      }
    }
  ],
  "relatedLocations": [
    {
      "id": 0,
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/audit.ts"
        },
        "region": {
          "startLine": 2,
          "startColumn": 13,
          "endLine": 2,
          "endColumn": 16
        }
      },
      "message": {
        "text": "effect row declared here"
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "declare the effect"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/audit.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 2,
                "startColumn": 16,
                "endLine": 2,
                "endColumn": 16
              },
              "insertedContent": {
                "text": ", fs.read"
              }
            }
          ]
        }
      ]
    },
    {
      "description": {
        "text": "thread an Fs.Read capability from the caller"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/audit.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 3,
                "startColumn": 1,
                "endLine": 3,
                "endColumn": 1
              },
              "insertedContent": {
                "text": " * @cap fs fs.read prefix=\"./receipts/\"\n"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0302 — declared effect never used

- Severity: `warning`
- Category: `effect`
- Docs: https://hewg.dev/e/E0302

### Human

```
warning[E0302]: declared effect `fs.write` is never used in the function body
  --> src/payments/refund.ts:3:26
  |
3 |  * @effects    net.https fs.write
  |                          ^^^^^^^^
  |
help: drop the unused effect
  |
3 |  * @effects    net.https fs.write
  |                         ~ 
  = help: https://hewg.dev/e/E0302
```

### JSON

```json
{"code":"E0302","severity":"warning","file":"src/payments/refund.ts","line":3,"col":26,"len":8,"message":"declared effect `fs.write` is never used in the function body","suggest":[{"kind":"remove-effect","rationale":"drop the unused effect","at":{"file":"src/payments/refund.ts","line":3,"col":25,"len":9},"insert":""}],"docs":"https://hewg.dev/e/E0302"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0302",
  "level": "warning",
  "message": {
    "text": "declared effect `fs.write` is never used in the function body"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 3,
          "startColumn": 26,
          "endLine": 3,
          "endColumn": 34
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "drop the unused effect"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 3,
                "startColumn": 25,
                "endLine": 3,
                "endColumn": 34
              },
              "insertedContent": {
                "text": ""
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0303 — effect row widening in override

- Severity: `error`
- Category: `effect`
- Docs: https://hewg.dev/e/E0303

### Human

```
error[E0303]: override widens effect row of parent declaration (adds `fs.write`)
  --> src/payments/refund.ts:3:16
  |
3 |  * @effects    net.https fs.write
  |                ^^^^^^^^^^^^^^^^^
  |
note: parent effect row declared here
  --> src/payments/refund.d.ts:2:13
  |
2 |  * @effects net.https
  |             ^^^^^^^^^
help: widen the parent declaration to match
  |
2 |  * @effects net.https
  |                      + , fs.write
  = help: https://hewg.dev/e/E0303
```

### JSON

```json
{"code":"E0303","severity":"error","file":"src/payments/refund.ts","line":3,"col":16,"len":17,"message":"override widens effect row of parent declaration (adds `fs.write`)","related":[{"file":"src/payments/refund.d.ts","line":2,"col":13,"len":9,"message":"parent effect row declared here"}],"suggest":[{"kind":"widen-effects","rationale":"widen the parent declaration to match","at":{"file":"src/payments/refund.d.ts","line":2,"col":22,"len":0},"insert":", fs.write"}],"docs":"https://hewg.dev/e/E0303"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0303",
  "level": "error",
  "message": {
    "text": "override widens effect row of parent declaration (adds `fs.write`)"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 3,
          "startColumn": 16,
          "endLine": 3,
          "endColumn": 33
        }
      }
    }
  ],
  "relatedLocations": [
    {
      "id": 0,
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.d.ts"
        },
        "region": {
          "startLine": 2,
          "startColumn": 13,
          "endLine": 2,
          "endColumn": 22
        }
      },
      "message": {
        "text": "parent effect row declared here"
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "widen the parent declaration to match"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.d.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 2,
                "startColumn": 22,
                "endLine": 2,
                "endColumn": 22
              },
              "insertedContent": {
                "text": ", fs.write"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0401 — capability scope mismatch

- Severity: `error`
- Category: `capability`
- Docs: https://hewg.dev/e/E0401

### Human

```
error[E0401]: capability scope too narrow: callee requires host="api.stripe.com", caller provides host="*"
  --> src/audit.ts:9:17
  |
9 |    await refund(client, 10);
  |                 ^^^^^^
  |
note: callee requires @cap here
  --> src/payments/refund.ts:4:4
  |
4 |  * @cap htpp net.https host="api.stripe.com"
  |    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
help: tighten the caller's capability scope to match the callee
  |
9 |    await refund(client, 10);
  |                 ~ stripeClient
  = help: https://hewg.dev/e/E0401
```

### JSON

```json
{"code":"E0401","severity":"error","file":"src/audit.ts","line":9,"col":17,"len":6,"message":"capability scope too narrow: callee requires host=\"api.stripe.com\", caller provides host=\"*\"","related":[{"file":"src/payments/refund.ts","line":4,"col":4,"len":40,"message":"callee requires @cap here"}],"suggest":[{"kind":"narrow-cap","rationale":"tighten the caller's capability scope to match the callee","at":{"file":"src/audit.ts","line":9,"col":17,"len":6},"insert":"stripeClient"}],"docs":"https://hewg.dev/e/E0401"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0401",
  "level": "error",
  "message": {
    "text": "capability scope too narrow: callee requires host=\"api.stripe.com\", caller provides host=\"*\""
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/audit.ts"
        },
        "region": {
          "startLine": 9,
          "startColumn": 17,
          "endLine": 9,
          "endColumn": 23
        }
      }
    }
  ],
  "relatedLocations": [
    {
      "id": 0,
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 4,
          "startColumn": 4,
          "endLine": 4,
          "endColumn": 44
        }
      },
      "message": {
        "text": "callee requires @cap here"
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "tighten the caller's capability scope to match the callee"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/audit.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 9,
                "startColumn": 17,
                "endLine": 9,
                "endColumn": 23
              },
              "insertedContent": {
                "text": "stripeClient"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0402 — missing capability at call site

- Severity: `error`
- Category: `capability`
- Docs: https://hewg.dev/e/E0402

### Human

```
error[E0402]: call to `refund` requires capability `http`, but caller does not declare one
  --> src/audit.ts:9:10
  |
9 |    await refund(client, 10);
  |          ^^^^^^
  |
help: add an @cap annotation for the caller
  |
3 |  * @cap log log
  | +  * @cap http net.https host="api.stripe.com"⏎
  = help: https://hewg.dev/e/E0402
```

### JSON

```json
{"code":"E0402","severity":"error","file":"src/audit.ts","line":9,"col":10,"len":6,"message":"call to `refund` requires capability `http`, but caller does not declare one","suggest":[{"kind":"add-cap","rationale":"add an @cap annotation for the caller","at":{"file":"src/audit.ts","line":3,"col":1,"len":0},"insert":" * @cap http net.https host=\"api.stripe.com\"\n"}],"docs":"https://hewg.dev/e/E0402"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0402",
  "level": "error",
  "message": {
    "text": "call to `refund` requires capability `http`, but caller does not declare one"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/audit.ts"
        },
        "region": {
          "startLine": 9,
          "startColumn": 10,
          "endLine": 9,
          "endColumn": 16
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "add an @cap annotation for the caller"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/audit.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 3,
                "startColumn": 1,
                "endLine": 3,
                "endColumn": 1
              },
              "insertedContent": {
                "text": " * @cap http net.https host=\"api.stripe.com\"\n"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0403 — capability passed as wrong parameter name

- Severity: `error`
- Category: `capability`
- Docs: https://hewg.dev/e/E0403

### Human

```
error[E0403]: capability argument `client` does not match parameter name `http` expected by callee
  --> src/audit.ts:9:17
  |
9 |    await refund(client, 10);
  |                 ^^^^^^
  |
help: rename the argument to match the capability parameter
  |
9 |    await refund(client, 10);
  |                 ~ http
  = help: https://hewg.dev/e/E0403
```

### JSON

```json
{"code":"E0403","severity":"error","file":"src/audit.ts","line":9,"col":17,"len":6,"message":"capability argument `client` does not match parameter name `http` expected by callee","suggest":[{"kind":"rename-arg","rationale":"rename the argument to match the capability parameter","at":{"file":"src/audit.ts","line":9,"col":17,"len":6},"insert":"http"}],"docs":"https://hewg.dev/e/E0403"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0403",
  "level": "error",
  "message": {
    "text": "capability argument `client` does not match parameter name `http` expected by callee"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/audit.ts"
        },
        "region": {
          "startLine": 9,
          "startColumn": 17,
          "endLine": 9,
          "endColumn": 23
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "rename the argument to match the capability parameter"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/audit.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 9,
                "startColumn": 17,
                "endLine": 9,
                "endColumn": 23
              },
              "insertedContent": {
                "text": "http"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## E0501 — malformed @pre/@post/@cost expression

- Severity: `error`
- Category: `contract`
- Docs: https://hewg.dev/e/E0501

### Human

```
error[E0501]: malformed @pre expression: unexpected token `>` at position 15
  --> src/payments/refund.ts:7:10
  |
7 |  * @pre  amountCents > 0 && tokens > zero
  |          ^^^^^^^^^^^^^^^^^^
  |
help: use `>=` for greater-or-equal
  |
7 |  * @pre  amountCents > 0 && tokens > zero
  |                        ~ >=
  = help: https://hewg.dev/e/E0501
```

### JSON

```json
{"code":"E0501","severity":"error","file":"src/payments/refund.ts","line":7,"col":10,"len":18,"message":"malformed @pre expression: unexpected token `>` at position 15","suggest":[{"kind":"fix-syntax","rationale":"use `>=` for greater-or-equal","at":{"file":"src/payments/refund.ts","line":7,"col":24,"len":1},"insert":">="}],"docs":"https://hewg.dev/e/E0501"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "E0501",
  "level": "error",
  "message": {
    "text": "malformed @pre expression: unexpected token `>` at position 15"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 7,
          "startColumn": 10,
          "endLine": 7,
          "endColumn": 28
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "use `>=` for greater-or-equal"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 7,
                "startColumn": 24,
                "endLine": 7,
                "endColumn": 25
              },
              "insertedContent": {
                "text": ">="
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## I0001 — symbol has no Hewg annotations

- Severity: `info`
- Category: `contract`
- Docs: https://hewg.dev/e/I0001

### Human

```
info[I0001]: symbol `payments/refund::refund` has no Hewg annotations; returning signature only
  --> src/payments/refund.ts:11:1
   |
11 | export async function refund(http: HttpClient, amountCents: number) {
   | ^^^^^^
   |
  = note: contract fields `effects`, `caps`, `pre`, `post`, `cost`, `errors` are null
  = help: https://hewg.dev/e/I0001
```

### JSON

```json
{"code":"I0001","severity":"info","file":"src/payments/refund.ts","line":11,"col":1,"len":6,"message":"symbol `payments/refund::refund` has no Hewg annotations; returning signature only","notes":[{"message":"contract fields `effects`, `caps`, `pre`, `post`, `cost`, `errors` are null"}],"docs":"https://hewg.dev/e/I0001"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "I0001",
  "level": "note",
  "message": {
    "text": "symbol `payments/refund::refund` has no Hewg annotations; returning signature only"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 11,
          "startColumn": 1,
          "endLine": 11,
          "endColumn": 7
        }
      }
    }
  ]
}
```

## W0001 — unknown @cost field

- Severity: `warning`
- Category: `warning`
- Docs: https://hewg.dev/e/W0001

### Human

```
warning[W0001]: unknown @cost field `tokenz`; expected one of tokens, ops, net, time
  --> src/payments/refund.ts:9:10
  |
9 |  * @cost tokenz=120 ops=~6
  |          ^^^^^^
  |
help: did you mean `tokens`?
  |
9 |  * @cost tokenz=120 ops=~6
  |          ~ tokens
  = help: https://hewg.dev/e/W0001
```

### JSON

```json
{"code":"W0001","severity":"warning","file":"src/payments/refund.ts","line":9,"col":10,"len":6,"message":"unknown @cost field `tokenz`; expected one of tokens, ops, net, time","suggest":[{"kind":"fix-cost-field","rationale":"did you mean `tokens`?","at":{"file":"src/payments/refund.ts","line":9,"col":10,"len":6},"insert":"tokens"}],"docs":"https://hewg.dev/e/W0001"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "W0001",
  "level": "warning",
  "message": {
    "text": "unknown @cost field `tokenz`; expected one of tokens, ops, net, time"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 9,
          "startColumn": 10,
          "endLine": 9,
          "endColumn": 16
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "did you mean `tokens`?"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 9,
                "startColumn": 10,
                "endLine": 9,
                "endColumn": 16
              },
              "insertedContent": {
                "text": "tokens"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## W0002 — unknown @hewg-* tag

- Severity: `warning`
- Category: `warning`
- Docs: https://hewg.dev/e/W0002

### Human

```
warning[W0002]: unknown tag `@hewg-magic`; will be ignored
  --> src/payments/refund.ts:2:4
  |
2 |  * @hewg-magic unused
  |    ^^^^^^^^^^^
  |
help: remove the unknown tag
  |
2 |  * @hewg-magic unused
  | ~ 
  = help: https://hewg.dev/e/W0002
```

### JSON

```json
{"code":"W0002","severity":"warning","file":"src/payments/refund.ts","line":2,"col":4,"len":11,"message":"unknown tag `@hewg-magic`; will be ignored","suggest":[{"kind":"remove-annotation","rationale":"remove the unknown tag","at":{"file":"src/payments/refund.ts","line":2,"col":1,"len":21},"insert":""}],"docs":"https://hewg.dev/e/W0002"}
```

### SARIF (excerpt)

```json
{
  "ruleId": "W0002",
  "level": "warning",
  "message": {
    "text": "unknown tag `@hewg-magic`; will be ignored"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "src/payments/refund.ts"
        },
        "region": {
          "startLine": 2,
          "startColumn": 4,
          "endLine": 2,
          "endColumn": 15
        }
      }
    }
  ],
  "fixes": [
    {
      "description": {
        "text": "remove the unknown tag"
      },
      "artifactChanges": [
        {
          "artifactLocation": {
            "uri": "src/payments/refund.ts"
          },
          "replacements": [
            {
              "deletedRegion": {
                "startLine": 2,
                "startColumn": 1,
                "endLine": 2,
                "endColumn": 22
              },
              "insertedContent": {
                "text": ""
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

Generated from `hewg-ts/src/diag/codes.ts` and `hewg-ts/src/diag/examples.ts`.
Run `bun run gen:docs` from `hewg-ts/` to regenerate.
