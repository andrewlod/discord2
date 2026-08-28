package middleware

import (
	"net/http"
	"strings"
	"time"

	"discord2/backend/internal/auth"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func AuthMiddleware(authService *auth.Service, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			return
		}

		claims, err := authService.ValidateAccessToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("username", claims.Username)
		c.Next()
	}
}

func OptionalAuthMiddleware(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Next()
			return
		}

		claims, err := authService.ValidateAccessToken(parts[1])
		if err != nil {
			c.Next()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("username", claims.Username)
		c.Next()
	}
}

func CORSMiddleware(frontendURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func Logger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		logger.Info("request",
			zap.String("method", method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.String("ip", clientIP),
			zap.Duration("latency", latency),
		)
	}
}

func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	type clientInfo struct {
		count     int
		resetTime time.Time
	}

	clients := make(map[string]*clientInfo)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		info, exists := clients[ip]
		if !exists || now.After(info.resetTime) {
			clients[ip] = &clientInfo{count: 1, resetTime: now.Add(window)}
			c.Next()
			return
		}

		if info.count >= limit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}

		info.count++
		c.Next()
	}
}