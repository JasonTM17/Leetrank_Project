package main

// profiles.go — per-language sandbox resource profile loader.
//
// profiles.json sits next to the binary and overrides the per-language CPU,
// memory, and wall-clock caps applied by buildNsjailArgv. The defaults stay
// in DefaultSandboxLimits; this layer only adjusts MemMB / CPUSeconds /
// WallSeconds, leaving the security-oriented caps (max processes, max
// open files, max file size) at their conservative defaults.

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
)

// LanguageProfile is one row in profiles.json — the three caps that vary
// meaningfully by toolchain. Other rlimits (nproc/nofile/fsize) stay
// language-agnostic.
type LanguageProfile struct {
	MemMB       int `json:"memMB"`
	CPUSeconds  int `json:"cpuSeconds"`
	WallSeconds int `json:"wallSeconds"`
}

// profilesFile mirrors profiles.json. The $comment field is ignored.
type profilesFile struct {
	Default   LanguageProfile            `json:"default"`
	Languages map[string]LanguageProfile `json:"languages"`
}

// ProfileRegistry indexes profiles by language id.
type ProfileRegistry struct {
	def     LanguageProfile
	byID    map[string]LanguageProfile
	loaded  bool
}

var (
	globalProfilesOnce sync.Once
	globalProfiles     *ProfileRegistry
)

// loadProfiles reads profiles.json from path and returns a populated
// registry. Missing file is non-fatal — we fall back to a registry whose
// default mirrors DefaultSandboxLimits (so behaviour is identical to the
// pre-profiles code path).
func loadProfiles(path string) (*ProfileRegistry, error) {
	r := &ProfileRegistry{
		def: LanguageProfile{
			MemMB:       DefaultSandboxLimits.MemMB,
			CPUSeconds:  DefaultSandboxLimits.CPUSeconds,
			WallSeconds: DefaultSandboxLimits.WallSeconds,
		},
		byID: map[string]LanguageProfile{},
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return r, nil
		}
		return r, fmt.Errorf("read %s: %w", path, err)
	}
	var f profilesFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return r, fmt.Errorf("parse %s: %w", path, err)
	}
	if f.Default.MemMB > 0 {
		r.def.MemMB = f.Default.MemMB
	}
	if f.Default.CPUSeconds > 0 {
		r.def.CPUSeconds = f.Default.CPUSeconds
	}
	if f.Default.WallSeconds > 0 {
		r.def.WallSeconds = f.Default.WallSeconds
	}
	for id, p := range f.Languages {
		r.byID[strings.ToLower(strings.TrimSpace(id))] = p
	}
	r.loaded = true
	return r, nil
}

// Lookup returns the profile for a language id, falling back to the
// registry's default for unknown ids. Unset fields on the language entry
// inherit from the default — this lets profiles.json override only the
// caps that actually differ per language.
func (r *ProfileRegistry) Lookup(id string) LanguageProfile {
	if r == nil {
		return LanguageProfile{
			MemMB:       DefaultSandboxLimits.MemMB,
			CPUSeconds:  DefaultSandboxLimits.CPUSeconds,
			WallSeconds: DefaultSandboxLimits.WallSeconds,
		}
	}
	p := r.def
	if v, ok := r.byID[strings.ToLower(strings.TrimSpace(id))]; ok {
		if v.MemMB > 0 {
			p.MemMB = v.MemMB
		}
		if v.CPUSeconds > 0 {
			p.CPUSeconds = v.CPUSeconds
		}
		if v.WallSeconds > 0 {
			p.WallSeconds = v.WallSeconds
		}
	}
	return p
}

// Loaded reports whether the registry was populated from a file (vs the
// fallback default). Used in startup logs so operators can confirm
// profiles.json was found.
func (r *ProfileRegistry) Loaded() bool {
	if r == nil {
		return false
	}
	return r.loaded
}

// initGlobalProfiles is called once from main.go at boot. After this,
// CurrentProfiles() returns the loaded registry from anywhere.
func initGlobalProfiles(path string) (*ProfileRegistry, error) {
	var err error
	globalProfilesOnce.Do(func() {
		globalProfiles, err = loadProfiles(path)
	})
	if globalProfiles == nil {
		// First initialiser failed; ensure callers still get a non-nil
		// registry with safe defaults rather than panicking.
		globalProfiles = &ProfileRegistry{
			def: LanguageProfile{
				MemMB:       DefaultSandboxLimits.MemMB,
				CPUSeconds:  DefaultSandboxLimits.CPUSeconds,
				WallSeconds: DefaultSandboxLimits.WallSeconds,
			},
			byID: map[string]LanguageProfile{},
		}
	}
	return globalProfiles, err
}

// CurrentProfiles returns the process-wide registry. Falls back to a
// safe default-only registry if init was never called (e.g. in tests).
func CurrentProfiles() *ProfileRegistry {
	if globalProfiles == nil {
		return &ProfileRegistry{
			def: LanguageProfile{
				MemMB:       DefaultSandboxLimits.MemMB,
				CPUSeconds:  DefaultSandboxLimits.CPUSeconds,
				WallSeconds: DefaultSandboxLimits.WallSeconds,
			},
			byID: map[string]LanguageProfile{},
		}
	}
	return globalProfiles
}
