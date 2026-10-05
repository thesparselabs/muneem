package health

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Gauges are replaced wholesale on each run, so a business or device that drops out leaves no stale series behind.
type Gauges struct {
	devices         *prometheus.GaugeVec
	outboxDepth     *prometheus.GaugeVec
	outboxAge       *prometheus.GaugeVec
	negativeStock   *prometheus.GaugeVec
	deadLetters     *prometheus.GaugeVec
	chainBreaks     *prometheus.GaugeVec
	backupAge       *prometheus.GaugeVec
	rejections      *prometheus.GaugeVec
	unbalanced      *prometheus.GaugeVec
	deviceOutbox    *prometheus.GaugeVec
	deviceOutboxAge *prometheus.GaugeVec
	deviceLastSeen  *prometheus.GaugeVec
	lastSuccess     *prometheus.GaugeVec
	tieOuts         *prometheus.GaugeVec
	replay          *prometheus.GaugeVec
	chainOk         *prometheus.GaugeVec
	integrityAge    *prometheus.GaugeVec
	journalDiff     *prometheus.GaugeVec
}

func NewGauges(reg prometheus.Registerer) *Gauges {
	g := func(name, help string, labels ...string) *prometheus.GaugeVec {
		v := prometheus.NewGaugeVec(prometheus.GaugeOpts{Namespace: "muneem", Name: name, Help: help}, labels)
		reg.MustRegister(v)
		return v
	}
	return &Gauges{
		devices:         g("business_devices", "Active devices per business; state is active (all) or silent (not seen within the silent window).", "business_id", "state"),
		outboxDepth:     g("business_outbox_depth_max", "The deepest device outbox in the business, from push heartbeats.", "business_id"),
		outboxAge:       g("business_outbox_oldest_age_seconds", "Age of the oldest operation still waiting on any device of the business; 0 when none.", "business_id"),
		negativeStock:   g("business_negative_stock_max", "Products below zero stock on the worst device of the business, from push heartbeats.", "business_id"),
		deadLetters:     g("business_dead_letters_unresolved", "Rejected operations not since applied.", "business_id"),
		chainBreaks:     g("business_audit_chain_breaks_recent", "Audit-chain breaks recorded within the breaks window (24 h by default).", "business_id"),
		backupAge:       g("business_backup_age_seconds", "Age of the newest confirmed cloud backup, or of the business when it has none.", "business_id"),
		rejections:      g("business_rejections_recent", "Operations rejected within the last hour, by error code.", "business_id", "code"),
		unbalanced:      g("business_unbalanced_journals", "Journals whose lines do not balance (slow probe).", "business_id"),
		deviceOutbox:    g("device_outbox_depth", "Outbox depth of the worst devices (top N).", "business_id", "device_id"),
		deviceOutboxAge: g("device_outbox_oldest_age_seconds", "Age of a top-N device's oldest waiting operation; 0 when none.", "business_id", "device_id"),
		deviceLastSeen:  g("device_last_seen_age_seconds", "Time since a top-N device last pushed or pulled.", "business_id", "device_id"),
		lastSuccess:     g("health_probe_last_success_timestamp_seconds", "When each probe last completed.", "probe"),
		tieOuts:         g("device_tie_out_failures", "Tie-outs failing in the device's last integrity run (ADR-0054).", "business_id", "device_id"),
		replay:          g("device_replay_mismatches", "Stock levels that disagreed with their movements in the device's last integrity run.", "business_id", "device_id"),
		chainOk:         g("device_audit_chain_ok", "1 when the device's audit chains verified in its last integrity run.", "business_id", "device_id"),
		integrityAge:    g("device_integrity_age_seconds", "Age of the device's last integrity report.", "business_id", "device_id"),
		journalDiff: g("device_journal_diff", "Device journals minus the cloud's up to the device's documents cursor; kind is count, debit_paise or credit_paise. Absent while the device had unsent operations.",
			"business_id", "device_id", "kind"),
	}
}

func age(now time.Time, at *time.Time) float64 {
	if at == nil {
		return 0
	}
	return max(now.Sub(*at).Seconds(), 0)
}

func (g *Gauges) SetBusinesses(now time.Time, rows []Business) {
	for _, v := range []*prometheus.GaugeVec{g.devices, g.outboxDepth, g.outboxAge, g.negativeStock, g.deadLetters, g.chainBreaks, g.backupAge} {
		v.Reset()
	}
	for _, b := range rows {
		id := b.BusinessID
		g.devices.WithLabelValues(id, "active").Set(float64(b.DevicesActive))
		g.devices.WithLabelValues(id, "silent").Set(float64(b.DevicesSilent))
		g.outboxDepth.WithLabelValues(id).Set(float64(b.OutboxDepthMax))
		g.outboxAge.WithLabelValues(id).Set(age(now, b.OldestPendingAt))
		g.negativeStock.WithLabelValues(id).Set(float64(b.NegativeStockMax))
		g.deadLetters.WithLabelValues(id).Set(float64(b.DeadLettersUnresolved))
		g.chainBreaks.WithLabelValues(id).Set(float64(b.AuditChainBreaks))
		backupAt := b.NewestBackupAt
		if backupAt == nil {
			backupAt = &b.BusinessCreatedAt
		}
		g.backupAge.WithLabelValues(id).Set(age(now, backupAt))
	}
}

func (g *Gauges) SetDevices(now time.Time, rows []Device) {
	g.deviceOutbox.Reset()
	g.deviceOutboxAge.Reset()
	g.deviceLastSeen.Reset()
	for _, d := range rows {
		g.deviceOutbox.WithLabelValues(d.BusinessID, d.DeviceID).Set(float64(d.OutboxDepth))
		g.deviceOutboxAge.WithLabelValues(d.BusinessID, d.DeviceID).Set(age(now, d.OldestPendingAt))
		if d.LastSeenAt != nil {
			g.deviceLastSeen.WithLabelValues(d.BusinessID, d.DeviceID).Set(age(now, d.LastSeenAt))
		}
	}
}

func (g *Gauges) SetRejections(rows []Rejection) {
	g.rejections.Reset()
	for _, r := range rows {
		g.rejections.WithLabelValues(r.BusinessID, r.Code).Set(float64(r.Rejected))
	}
}

// SetUnbalanced zeroes every business the fast probe knows, so "no imbalance" is a 0 series rather than an absent one.
func (g *Gauges) SetUnbalanced(known []Business, rows []Imbalance) {
	g.unbalanced.Reset()
	for _, b := range known {
		g.unbalanced.WithLabelValues(b.BusinessID).Set(0)
	}
	for _, r := range rows {
		g.unbalanced.WithLabelValues(r.BusinessID).Set(float64(r.Journals))
	}
}

func (g *Gauges) Succeeded(probe string, now time.Time) {
	g.lastSuccess.WithLabelValues(probe).Set(float64(now.Unix()))
}

func (g *Gauges) SetIntegrity(now time.Time, rows []DeviceIntegrity) {
	for _, v := range []*prometheus.GaugeVec{g.tieOuts, g.replay, g.chainOk, g.integrityAge, g.journalDiff} {
		v.Reset()
	}
	for _, r := range rows {
		b, d := r.BusinessID, r.DeviceID
		g.tieOuts.WithLabelValues(b, d).Set(float64(r.TieOutFailures))
		g.replay.WithLabelValues(b, d).Set(float64(r.ReplayMismatches))
		ok := 0.0
		if r.AuditChainOk {
			ok = 1
		}
		g.chainOk.WithLabelValues(b, d).Set(ok)
		g.integrityAge.WithLabelValues(b, d).Set(age(now, &r.CheckedAt))
		for kind, diff := range map[string]*int64{"count": r.JournalCountDiff, "debit_paise": r.DebitDiffPaise, "credit_paise": r.CreditDiffPaise} {
			if diff != nil {
				g.journalDiff.WithLabelValues(b, d, kind).Set(float64(*diff))
			}
		}
	}
}
