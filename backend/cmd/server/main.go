package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"discord2/backend/internal/api"
	"discord2/backend/internal/auth"
	"discord2/backend/internal/config"
	"discord2/backend/internal/db"
	"discord2/backend/internal/middleware"
	"discord2/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx := context.Background()

	database, err := db.New(ctx, &cfg.Database, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer database.Close()

	if err := database.Migrate(ctx); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	authService := auth.NewService(cfg, database.Pool, logger)
	wsHub := ws.NewHub(logger)
	wsHub.DB = database
	go wsHub.Run(ctx)

	router := setupRouter(cfg, database, authService, wsHub, logger)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.App.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("starting server", zap.Int("port", cfg.App.Port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server exited")
}

func setupRouter(
	cfg *config.Config,
	database *db.DB,
	authService *auth.Service,
	wsHub *ws.Hub,
	logger *zap.Logger,
) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORSMiddleware(cfg.App.FrontendURL))

	api.RegisterRoutes(router, cfg.App.FrontendURL, database, authService, wsHub, cfg, logger)

	return router
}