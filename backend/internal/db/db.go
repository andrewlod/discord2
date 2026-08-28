package db

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"discord2/backend/internal/config"
)

//go:embed migrations/v2/*.sql
var migrationFS embed.FS

type DB struct {
	Pool *pgxpool.Pool
	log  *zap.Logger
}

func New(ctx context.Context, cfg *config.DatabaseConfig, log *zap.Logger) (*DB, error) {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s&pool_max_conns=%d&pool_min_conns=%d&pool_max_conn_lifetime=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name, cfg.SSLMode,
		cfg.MaxOpenConns, cfg.MaxIdleConns, cfg.MaxConnLifetime,
	)

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		log.Debug("new database connection established")
		return nil
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	log.Info("database connected",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("database", cfg.Name),
	)

	return &DB{Pool: pool, log: log}, nil
}

func (d *DB) Close() {
	d.Pool.Close()
	d.log.Info("database connection closed")
}

func (d *DB) Ping(ctx context.Context) error {
	return d.Pool.Ping(ctx)
}

// Migrate applies all embedded v2+ migrations idempotently, tracking applied
// versions in the schema_migrations table.
func (d *DB) Migrate(ctx context.Context) error {
	if _, err := d.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS applied_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create applied_migrations: %w", err)
	}

	entries, err := migrationFS.ReadDir("migrations/v2")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var exists bool
		if err := d.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM applied_migrations WHERE version = $1)`, name).Scan(&exists); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if exists {
			continue
		}

		data, err := migrationFS.ReadFile("migrations/v2/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		for _, stmt := range splitStatements(string(data)) {
			if _, err := d.Pool.Exec(ctx, stmt); err != nil {
				return fmt.Errorf("apply migration %s: %w", name, err)
			}
		}

		if _, err := d.Pool.Exec(ctx, `INSERT INTO applied_migrations (version) VALUES ($1)`, name); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		d.log.Info("applied migration", zap.String("version", name))
	}

	return nil
}

func splitStatements(sql string) []string {
	parts := strings.Split(sql, ";")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed == "" {
			continue
		}
		out = append(out, trimmed)
	}
	return out
}