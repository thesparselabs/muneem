package devicesync

import "testing"

// Audit rows are push-only, so they are in no bundle.
func TestLatestStateTypesCoverEveryNonDocumentType(t *testing.T) {
	listed := map[string]string{}
	for stream, types := range LatestStateTypes {
		for _, entityType := range types {
			listed[entityType] = stream
		}
	}
	for entityType, stream := range streamOf {
		if stream != StreamDocuments && stream != StreamAudit && listed[entityType] != stream {
			t.Errorf("%s: listed under %q, streams to %q", entityType, listed[entityType], stream)
		}
	}
}
