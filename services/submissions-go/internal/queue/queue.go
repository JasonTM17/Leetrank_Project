// Package queue owns the background machinery that watches the submissions
// table for queue depth (pending count) and dead-letter candidates
// (submissions stuck in 'judging' beyond a deadline).
//
// Two pieces:
//
//   - Queue-depth gauge — a prometheus.GaugeFunc that on each scrape runs
//     SELECT COUNT(*) FROM "Submission" WHERE status='pending'. The query is
//     cheap (status is indexed in production) and gives operators a real-time
//     view of judge backlog without polling overhead.
//
//   - DLQ sweeper — a goroutine that ticks every 30s, finds rows where
//     status='judging' AND "createdAt" < NOW() - 60s, flips them to
//     status='failed' with error='judge_timeout', and increments the
//     submissions_dlq_total{reason="judge_timeout"} counter so alerts can
//     fire when judges drop submissions on the floor.
package queue

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog"
)

// Defaults — overridable via the Sweeper struct fields for tests.
const (
	defaultStuckThreshold = 60 * time.Second
	defaultSweepInterval  = 30 * time.Second
)

var (
	// queueDepth is a GaugeFunc registered once and shared across the
	// process. The collector calls the closure every /metrics scrape.
	queueDepthValue atomic.Int64

	queueDepth = prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Name: "submissions_queue_depth",
			Help: "Number of submissions currently in 'pending' state, awaiting dispatch.",
		},
		func() float64 {
			return float64(queueDepthValue.Load())
		},
	)

	// dlqTotal counts every row the sweeper moved to status=failed,
	// labelled by the reason that classified it.
	dlqTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "submissions_dlq_total",
			Help: "Submissions moved to dead-letter (status=failed) by the sweeper.",
		},
		[]string{"reason"},
	)
)

func init() {
	prometheus.MustRegister(queueDepth, dlqTotal)
}

// Sweeper bundles the background work: queue-depth refresh + DLQ sweep.
type Sweeper struct {
	Pool            *pgxpool.Pool
	Logger          zerolog.Logger
	StuckThreshold  time.Duration // a row is DLQ-eligible after this much time in 'judging'
	SweepInterval   time.Duration // tick cadence for sweep + depth refresh
}

// New returns a Sweeper with sensible defaults applied.
func New(pool *pgxpool.Pool, logger zerolog.Logger) *Sweeper {
	return &Sweeper{
		Pool:           pool,
		Logger:         logger,
		StuckThreshold: defaultStuckThreshold,
		SweepInterval:  defaultSweepInterval,
	}
}

// Run blocks on the supplied context, ticking every SweepInterval to refresh
// the queue-depth gauge and run the DLQ sweep. Cancel ctx to stop. Errors
// from individual queries are logged but do not terminate the loop —
// transient DB hiccups should not silence the gauge for ever.
func (s *Sweeper) Run(ctx context.Context) {
	if s.SweepInterval <= 0 {
		s.SweepInterval = defaultSweepInterval
	}
	if s.StuckThreshold <= 0 {
		s.StuckThreshold = defaultStuckThreshold
	}
	ticker := time.NewTicker(s.SweepInterval)
	defer ticker.Stop()

	// Run once immediately so the gauge is non-zero before first tick.
	s.tickOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tickOnce(ctx)
		}
	}
}

// tickOnce performs one cycle: refresh depth, sweep stuck rows. Exported
// for tests via the SweepOnce wrapper.
func (s *Sweeper) tickOnce(ctx context.Context) {
	if depth, err := s.refreshDepth(ctx); err != nil {
		s.Logger.Warn().Err(err).Msg("queue: depth refresh failed")
	} else {
		queueDepthValue.Store(depth)
	}

	if moved, err := s.sweepStuck(ctx); err != nil {
		s.Logger.Warn().Err(err).Msg("queue: dlq sweep failed")
	} else if moved > 0 {
		s.Logger.Info().Int64("moved", moved).Msg("queue: dlq sweep moved stuck submissions")
		dlqTotal.WithLabelValues("judge_timeout").Add(float64(moved))
	}
}

// SweepOnce runs a single tick synchronously. Tests use this to assert
// behaviour without spinning up a goroutine.
func (s *Sweeper) SweepOnce(ctx context.Context) {
	s.tickOnce(ctx)
}

// refreshDepth returns the count of submissions in 'pending' state.
func (s *Sweeper) refreshDepth(ctx context.Context) (int64, error) {
	queryCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var n int64
	err := s.Pool.QueryRow(queryCtx,
		`SELECT COUNT(*) FROM "Submission" WHERE status = 'pending'`,
	).Scan(&n)
	return n, err
}

// sweepStuck moves rows where status='judging' AND createdAt is older
// than StuckThreshold into status='failed' with error='judge_timeout'.
// Returns the number of rows updated.
func (s *Sweeper) sweepStuck(ctx context.Context) (int64, error) {
	queryCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	cutoff := time.Now().Add(-s.StuckThreshold)
	tag, err := s.Pool.Exec(queryCtx,
		`UPDATE "Submission"
		    SET status = 'failed',
		        error  = 'judge_timeout'
		  WHERE status = 'judging'
		    AND "createdAt" < $1`,
		cutoff,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// QueueDepthForTest is a test-only accessor for the latest gauge value.
// Production code should scrape /metrics instead.
func QueueDepthForTest() int64 {
	return queueDepthValue.Load()
}

// SetQueueDepthForTest forces the gauge value. Tests use this to verify
// the GaugeFunc plumbing without going through the DB.
func SetQueueDepthForTest(v int64) {
	queueDepthValue.Store(v)
}
