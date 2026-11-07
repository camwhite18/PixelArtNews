package pipeline

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/camwhite18/pixelartnews/server/internal/rundown"
)

// Media layout under MEDIA_DIR:
//
//	audio/{channel}/{segment}.mp3
//	rundowns/{channel}/{run}.json
//	rundowns/{channel}/latest.json   (replaced atomically, last)

func audioKey(channelID, segID string) string {
	return filepath.ToSlash(filepath.Join("audio", channelID, segID+".mp3"))
}

func latestPath(mediaDir, channelID string) string {
	return filepath.Join(mediaDir, "rundowns", channelID, "latest.json")
}

// writeFileAtomic writes to a temp file in the same directory, then renames
// it into place so readers never see a half-written file.
func writeFileAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }() // no-op once renamed
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o640); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// LoadLatest reads a channel's current rundown, or nil if it has none yet.
func LoadLatest(mediaDir, channelID string) (*rundown.Rundown, error) {
	data, err := os.ReadFile(latestPath(mediaDir, channelID))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var r rundown.Rundown
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, fmt.Errorf("corrupt latest.json for %s: %w", channelID, err)
	}
	return &r, nil
}

// Publish writes the versioned rundown, then swaps latest.json to point at it.
func Publish(mediaDir string, runID int64, r rundown.Rundown) error {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return err
	}
	versioned := filepath.Join(mediaDir, "rundowns", r.Channel, fmt.Sprintf("%d.json", runID))
	if err := writeFileAtomic(versioned, data); err != nil {
		return err
	}
	return writeFileAtomic(latestPath(mediaDir, r.Channel), data)
}
