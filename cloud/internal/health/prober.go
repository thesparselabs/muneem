package health

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"time"
)

type Options struct {
	Interval       time.Duration // fast probes; 0 disables the job
	LedgerInterval time.Duration // journal balance and device-vs-cloud journal totals, which read every journal line
	TopDevices     int           // per-device series are capped at this many devices
	SilentAfter    time.Duration
	BreaksWithin   time.Duration
	RejectedWithin time.Duration
}

var DefaultOptions = Options{Interval: time.Minute, LedgerInterval: 15 * time.Minute, TopDevices: 50,
	SilentAfter: 24 * time.Hour, BreaksWithin: 24 * time.Hour, RejectedWithin: time.Hour}

// JobObserver records each probe's outcome and duration; metrics.Metrics implements it.
type JobObserver interface {
	ObserveJob(job, outcome string, took time.Duration)
}

// Prober runs the probes one at a time: a run still going when the next is due is skipped, never stacked.
type Prober struct {
	Source Source
	Gauges *Gauges
	Jobs   JobObserver
	Log    *slog.Logger
	Opt    Options
	Now    func() time.Time

	running    sync.Mutex
	known      []Business
	lastLedger time.Time
}

func (p *Prober) now() time.Time {
	if p.Now != nil {
		return p.Now()
	}
	return time.Now()
}

// Run probes until ctx ends.
func (p *Prober) Run(ctx context.Context) {
	if p.Opt.Interval <= 0 {
		return
	}
	t := time.NewTicker(p.Opt.Interval)
	defer t.Stop()
	for {
		p.RunOnce(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// RunOnce runs the fast probes, and the ledger probe when it is due; it returns false when another run holds the slot.
func (p *Prober) RunOnce(ctx context.Context) bool {
	if !p.running.TryLock() {
		return false
	}
	defer p.running.Unlock()
	ctx, cancel := context.WithTimeout(ctx, max(p.Opt.Interval/2, 5*time.Second))
	defer cancel()
	p.probe(ctx, "businesses", p.businesses)
	p.probe(ctx, "devices", p.devices)
	p.probe(ctx, "rejections", p.rejections)
	if p.lastLedger.IsZero() || p.now().Sub(p.lastLedger) >= p.Opt.LedgerInterval {
		if p.probe(ctx, "ledger", p.ledger) {
			p.lastLedger = p.now()
		}
	}
	return true
}

func (p *Prober) probe(ctx context.Context, name string, fn func(context.Context, time.Time) error) bool {
	started := time.Now()
	err := fn(ctx, p.now())
	outcome := "ok"
	if err != nil {
		outcome = "failed"
		if p.Log != nil {
			p.Log.Error("health probe failed", "probe", name, "error", err)
		}
	} else {
		p.Gauges.Succeeded(name, p.now())
	}
	if p.Jobs != nil {
		p.Jobs.ObserveJob("health_"+name, outcome, time.Since(started))
	}
	return err == nil
}

func (p *Prober) businesses(ctx context.Context, now time.Time) error {
	rows, err := p.Source.Businesses(ctx, p.Opt.SilentAfter, p.Opt.BreaksWithin)
	if err != nil {
		return err
	}
	p.known = rows
	p.Gauges.SetBusinesses(now, rows)
	return nil
}

func (p *Prober) devices(ctx context.Context, now time.Time) error {
	rows, err := p.Source.Devices(ctx, p.Opt.TopDevices)
	if err != nil {
		return err
	}
	p.Gauges.SetDevices(now, rows)
	return nil
}

func (p *Prober) rejections(ctx context.Context, _ time.Time) error {
	rows, err := p.Source.Rejections(ctx, p.Opt.RejectedWithin)
	if err != nil {
		return err
	}
	p.Gauges.SetRejections(rows)
	return nil
}

func (p *Prober) ledger(ctx context.Context, _ time.Time) error {
	rows, err := p.Source.UnbalancedJournals(ctx)
	if err != nil {
		return err
	}
	p.Gauges.SetUnbalanced(p.known, rows)
	integrity, err := p.Source.DeviceIntegrity(ctx)
	if err != nil {
		return err
	}
	p.Gauges.SetIntegrity(p.now(), integrity)
	return nil
}

// OptionsFromEnv reads MUNEEM_HEALTH_PROBE_INTERVAL, MUNEEM_HEALTH_LEDGER_INTERVAL and MUNEEM_HEALTH_TOP_DEVICES.
func OptionsFromEnv(getenv func(string) string) (Options, error) {
	o := DefaultOptions
	for _, d := range []struct {
		key string
		dst *time.Duration
	}{{"MUNEEM_HEALTH_PROBE_INTERVAL", &o.Interval}, {"MUNEEM_HEALTH_LEDGER_INTERVAL", &o.LedgerInterval}} {
		if v := getenv(d.key); v != "" {
			parsed, err := time.ParseDuration(v)
			if err != nil || parsed < 0 {
				return o, fmt.Errorf("%s must be a non-negative duration such as 60s", d.key)
			}
			*d.dst = parsed
		}
	}
	if v := getenv("MUNEEM_HEALTH_TOP_DEVICES"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 1000 {
			return o, fmt.Errorf("MUNEEM_HEALTH_TOP_DEVICES must be 1 to 1000")
		}
		o.TopDevices = n
	}
	return o, nil
}
