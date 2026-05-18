# LeetRank Judge Service

A Go-based code execution service that safely runs user-submitted code against test cases.

## Supported Languages

### Scripting
| Language | ID | Runtime |
|---|---|---|
| Python 3 | `python` | python3 |
| JavaScript (Node) | `javascript` | node 20 |
| TypeScript | `typescript` | tsx |
| Ruby | `ruby` | ruby |
| PHP | `php` | php-cli |
| Bash | `bash` | bash |
| Lua | `lua` | lua5.4 |
| Perl | `perl` | perl |
| Elixir | `elixir` | elixir |

### Compiled
| Language | ID | Toolchain |
|---|---|---|
| Go | `go` | golang-go |
| Rust | `rust` | rustc |
| C (gcc) | `c` | gcc |
| C++ (g++) | `cpp` | g++ |
| C# (Mono) | `csharp` | mono-mcs / mono |

### JVM
| Language | ID | Toolchain |
|---|---|---|
| Java | `java` | default-jdk (javac) |
| Kotlin | `kotlin` | kotlinc |
| Scala | `scala` | scalac |

### Data
| Language | ID | Runtime |
|---|---|---|
| SQL (sqlite) | `sql` | sqlite3 |
| R | `r` | Rscript |

## Deferred Languages

The following languages were evaluated but deferred from v1 due to image size or external apt repo requirements:

| Language | Reason |
|---|---|
| Swift | Requires `packages.swift.org` apt key; runtime ~600 MB |
| Haskell | `ghc` ~700 MB; would push image past 3 GB |
| Dart | Requires Google apt key (`dl.google.com/linux/dart/deb`) |

## Running

```bash
cd judge-service
go run main.go
```

The service starts on port 9090 by default. Set `JUDGE_PORT` env var to change.

## API

### POST /run
Execute code against test cases.

```json
{
  "code": "print(input())",
  "language": "python",
  "testCases": [
    {"input": "hello", "expected": "hello"}
  ],
  "timeLimit": 5000
}
```

### GET /health
Health check endpoint.

## Security
- Dangerous operations are blocked per-language (os, subprocess, eval, exec, file I/O, network, etc.)
- Time limit per test case (default 5s)
- No network access from executed code
- Temp files cleaned up after execution

## Upgrading to Docker Sandbox
For production, wrap each execution in a Docker container:
1. Create a minimal Docker image per language
2. Mount code as read-only volume
3. Set memory limits, CPU limits, no network
4. Use `docker run --rm --network=none --memory=256m --cpus=1`
5. Replace exec.Command with docker run command
