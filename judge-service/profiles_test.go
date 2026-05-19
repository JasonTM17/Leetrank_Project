package main

// profiles_test.go — verifies that profiles.json is parsed correctly and
// that limitsForLang threads the right per-language caps through.

import (
	"path/filepath"
	"testing"
)

func TestProfiles_LookupKnownLanguages(t *testing.T) {
	r, err := loadProfiles(filepath.Join(".", "profiles.json"))
	if err != nil {
		t.Fatalf("loadProfiles: %v", err)
	}
	if !r.Loaded() {
		t.Fatalf("expected profiles.json to load")
	}

	cases := []struct {
		id      string
		wantMem int
		wantCPU int
		wantWal int
	}{
		{"python", 256, 5, 10},
		{"java", 384, 8, 15},
		{"kotlin", 384, 8, 15},
		{"c", 256, 2, 5},
		{"cpp", 256, 2, 5},
		{"go", 256, 2, 5},
		{"rust", 256, 2, 5},
		// Unknown id → falls through to default (matches DefaultSandboxLimits).
		{"esoteric-unknown-xyz", DefaultSandboxLimits.MemMB, DefaultSandboxLimits.CPUSeconds, DefaultSandboxLimits.WallSeconds},
	}
	for _, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			got := r.Lookup(c.id)
			if got.MemMB != c.wantMem {
				t.Errorf("MemMB = %d, want %d", got.MemMB, c.wantMem)
			}
			if got.CPUSeconds != c.wantCPU {
				t.Errorf("CPUSeconds = %d, want %d", got.CPUSeconds, c.wantCPU)
			}
			if got.WallSeconds != c.wantWal {
				t.Errorf("WallSeconds = %d, want %d", got.WallSeconds, c.wantWal)
			}
		})
	}
}

func TestProfiles_MissingFileFallsBackToDefaults(t *testing.T) {
	r, err := loadProfiles(filepath.Join(t.TempDir(), "does-not-exist.json"))
	if err != nil {
		t.Fatalf("missing-file load returned err: %v", err)
	}
	if r.Loaded() {
		t.Fatalf("expected Loaded()=false for missing file")
	}
	got := r.Lookup("python")
	if got.MemMB != DefaultSandboxLimits.MemMB {
		t.Errorf("MemMB fallback = %d, want %d", got.MemMB, DefaultSandboxLimits.MemMB)
	}
	if got.CPUSeconds != DefaultSandboxLimits.CPUSeconds {
		t.Errorf("CPUSeconds fallback = %d, want %d", got.CPUSeconds, DefaultSandboxLimits.CPUSeconds)
	}
}

func TestLimitsForLang_RespectsRequestBudget(t *testing.T) {
	// Force the global registry to the on-disk profiles file so this test
	// reflects production behaviour. globalProfilesOnce makes this a no-op
	// after the first init in this process.
	if _, err := initGlobalProfiles(filepath.Join(".", "profiles.json")); err != nil {
		t.Fatalf("initGlobalProfiles: %v", err)
	}

	// Java profile is 8s CPU / 15s wall. A 1s request budget must shrink
	// CPU/wall but leave the 384MB profile cap untouched.
	got := limitsForLang("java", 1000)
	if got.MemMB != 384 {
		t.Errorf("MemMB = %d, want 384", got.MemMB)
	}
	if got.CPUSeconds > 8 {
		t.Errorf("CPUSeconds = %d, want <= 8 (profile cap)", got.CPUSeconds)
	}
	if got.WallSeconds > 15 {
		t.Errorf("WallSeconds = %d, want <= 15 (profile cap)", got.WallSeconds)
	}

	// timeLimitMs=0 → use full profile defaults.
	def := limitsForLang("java", 0)
	if def.CPUSeconds != 8 || def.WallSeconds != 15 {
		t.Errorf("zero-budget limits = %+v, want cpu=8 wall=15", def)
	}
}
