# LeetRank Judge Service

A Go-based code execution service that safely runs user-submitted code against test cases.

## Supported Languages
- Python 3
- JavaScript (Node.js)
- Go
- Ruby

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
- Dangerous operations are blocked (os, subprocess, eval, exec, etc.)
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
