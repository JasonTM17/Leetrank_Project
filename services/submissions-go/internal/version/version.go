// Package version holds the build-time version string injected via
// -ldflags="-X github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/version.Version=<sha>".
package version

// Version is the build-time version string. Defaults to "dev" when not
// injected by the build pipeline.
var Version = "dev"
