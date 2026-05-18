package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// LanguageConfig describes one language entry from languages.json. The Go
// server uses this to drive compile + run without hard-coding switches per
// language.
type LanguageConfig struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	Extension  string   `json:"extension"`
	Kind       string   `json:"kind"` // "interpreted" | "compiled"
	CompileCmd []string `json:"compileCmd,omitempty"`
	RunCmd     []string `json:"runCmd"`
	MainClass  string   `json:"mainClass,omitempty"`
	Category   string   `json:"category"`
}

// languagesFile mirrors the shape of judge-service/languages.json. The JSON
// has top-level metadata fields prefixed with $; we ignore them.
type languagesFile struct {
	Languages []LanguageConfig `json:"languages"`
}

// LanguageRegistry indexes language configs by id for O(1) lookup.
type LanguageRegistry struct {
	byID map[string]LanguageConfig
}

// loadLanguageRegistry reads languages.json from the given path and builds
// the registry. Each entry is validated (id, extension, runCmd required;
// compiled kind requires compileCmd).
func loadLanguageRegistry(path string) (*LanguageRegistry, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var f languagesFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if len(f.Languages) == 0 {
		return nil, fmt.Errorf("%s: no languages defined", path)
	}
	byID := make(map[string]LanguageConfig, len(f.Languages))
	for i, lc := range f.Languages {
		if lc.ID == "" {
			return nil, fmt.Errorf("%s[%d]: id required", path, i)
		}
		if lc.Extension == "" {
			return nil, fmt.Errorf("%s[%s]: extension required", path, lc.ID)
		}
		if len(lc.RunCmd) == 0 {
			return nil, fmt.Errorf("%s[%s]: runCmd required", path, lc.ID)
		}
		if lc.Kind == "compiled" && len(lc.CompileCmd) == 0 {
			return nil, fmt.Errorf("%s[%s]: compiled kind requires compileCmd", path, lc.ID)
		}
		if _, dup := byID[lc.ID]; dup {
			return nil, fmt.Errorf("%s: duplicate id %q", path, lc.ID)
		}
		byID[lc.ID] = lc
	}
	return &LanguageRegistry{byID: byID}, nil
}

// Get returns the config for an id (case-insensitive) and whether it exists.
func (r *LanguageRegistry) Get(id string) (LanguageConfig, bool) {
	lc, ok := r.byID[strings.ToLower(strings.TrimSpace(id))]
	return lc, ok
}

// IDs returns the supported language ids.
func (r *LanguageRegistry) IDs() []string {
	ids := make([]string, 0, len(r.byID))
	for id := range r.byID {
		ids = append(ids, id)
	}
	return ids
}

// expandPlaceholders rewrites {src}, {bin}, {workdir} in a command template
// against a concrete execution context. Unknown placeholders are left as-is.
func expandPlaceholders(cmd []string, ctx execContext) []string {
	out := make([]string, len(cmd))
	for i, arg := range cmd {
		s := arg
		s = strings.ReplaceAll(s, "{src}", ctx.SrcPath)
		s = strings.ReplaceAll(s, "{bin}", ctx.BinPath)
		s = strings.ReplaceAll(s, "{workdir}", ctx.Workdir)
		out[i] = s
	}
	return out
}

// execContext is the per-invocation state used to expand command templates.
type execContext struct {
	Workdir string
	SrcPath string
	BinPath string
}
