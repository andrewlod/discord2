package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"discord2/backend/internal/auth"
	"discord2/backend/internal/calls"
	"discord2/backend/internal/config"
	"discord2/backend/internal/db"
	"discord2/backend/internal/middleware"
	"discord2/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	lkauth "github.com/livekit/protocol/auth"
	"go.uber.org/zap"
)

func RegisterRoutes(
	router *gin.Engine,
	frontendURL string,
	database *db.DB,
	authService *auth.Service,
	wsHub *ws.Hub,
	cfg *config.Config,
	logger *zap.Logger,
) {
	authMiddleware := middleware.AuthMiddleware(authService, logger)

	api := router.Group("/api/v1")
	{
		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/register", registerHandler(authService))
			authRoutes.POST("/login", loginHandler(authService))
			authRoutes.POST("/refresh", refreshHandler(authService))
			authRoutes.POST("/logout", authMiddleware, logoutHandler(authService))
			authRoutes.GET("/me", authMiddleware, meHandler(authService))
			authRoutes.PATCH("/me", authMiddleware, updateMeHandler(authService))

			authRoutes.GET("/google", googleAuthHandler(authService))
			authRoutes.GET("/google/callback", googleCallbackHandler(authService, frontendURL))
		}

		users := api.Group("/users")
		users.Use(authMiddleware)
		{
			users.GET("/@me", meHandler(authService))
			users.GET("/:id", getUserHandler(database))
			users.GET("/search", searchUsersHandler(database))
		}

		servers := api.Group("/servers")
		servers.Use(authMiddleware)
		{
			servers.GET("", listServersHandler(database))
			servers.POST("", createServerHandler(database))
			servers.GET("/:id", getServerHandler(database))
			servers.PATCH("/:id", updateServerHandler(database))
			servers.DELETE("/:id", deleteServerHandler(database))

			servers.GET("/:id/channels", listChannelsHandler(database))
			servers.POST("/:id/channels", createChannelHandler(database))
			servers.GET("/:id/members", listMembersHandler(database))
			servers.POST("/:id/members", addMemberHandler(database))
			servers.DELETE("/:id/members/:user_id", removeMemberHandler(database))
			servers.PATCH("/:id/members/@me", updateMemberHandler(database))

			servers.GET("/:id/voice-states", listVoiceStatesHandler(database))
		}

		channels := api.Group("/channels")
		channels.Use(authMiddleware)
		{
			channels.GET("/:id", getChannelHandler(database))
			channels.PATCH("/:id", updateChannelHandler(database))
			channels.DELETE("/:id", deleteChannelHandler(database))
			channels.GET("/:id/messages", listMessagesHandler(database))
			channels.POST("/:id/messages", createMessageHandler(database, wsHub))
			channels.GET("/:id/messages/:message_id", getMessageHandler(database))
			channels.PATCH("/:id/messages/:message_id", updateMessageHandler(database))
			channels.DELETE("/:id/messages/:message_id", deleteMessageHandler(database))
			channels.POST("/:id/messages/:message_id/reactions", addReactionHandler(database))
			channels.DELETE("/:id/messages/:message_id/reactions/:emoji", removeReactionHandler(database))
		}

		dms := api.Group("/dms")
		dms.Use(authMiddleware)
		{
			dms.GET("", listDMsHandler(database))
			dms.POST("", createDMHandler(database))
			dms.GET("/:id", getDMHandler(database))
			dms.POST("/:id/messages", createDMMessageHandler(database, wsHub))
			dms.GET("/:id/messages", listDMMessagesHandler(database))
		}

		voice := api.Group("/voice")
		voice.Use(authMiddleware)
		{
			voice.POST("/token", getVoiceTokenHandler(cfg.LiveKit))
			voice.GET("/states", listVoiceStatesHandler(database))
		}

		callsSvc := calls.New(cfg.LiveKit, wsHub, database, logger)

		calls := api.Group("/calls")
		calls.Use(authMiddleware)
		{
			calls.POST("/1:1/start", startOneToOneCallHandler(callsSvc, cfg.LiveKit))
			calls.POST("/group/start", startGroupCallHandler(callsSvc, cfg.LiveKit, database))
			calls.POST("/:id/accept", acceptCallHandler(callsSvc, cfg.LiveKit))
			calls.POST("/:id/decline", declineCallHandler(callsSvc))
			calls.POST("/:id/end", endCallHandler(callsSvc))
			calls.GET("/:id/token", callTokenHandler(callsSvc, cfg.LiveKit))
			calls.GET("/active", listActiveCallsHandler(callsSvc))
		}

		live := api.Group("/live")
		live.Use(authMiddleware)
		{
			live.POST("/start", startLiveHandler(callsSvc, cfg.LiveKit, database))
			live.POST("/:id/end", endLiveHandler(callsSvc))
			live.GET("/:id/token", liveTokenHandler(callsSvc, cfg.LiveKit))
			live.GET("/:id/viewers", listLiveViewersHandler(callsSvc))
		}

		api.GET("/ws", websocketHandler(wsHub, authService, logger))
	}

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}

type Config interface {
	GetFrontendURL() string
}

func registerHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email    string `json:"email" binding:"required,email"`
			Username string `json:"username" binding:"required,min=2,max=32"`
			Password string `json:"password" binding:"required,min=8,max=128"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, tokens, err := authService.Register(c.Request.Context(), req.Email, req.Username, req.Password)
		if err != nil {
			if err == auth.ErrUserExists {
				c.JSON(http.StatusConflict, gin.H{"error": "user already exists"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"user":   user,
			"tokens": tokens,
		})
	}
}

func loginHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email    string `json:"email" binding:"required,email"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, tokens, err := authService.Login(c.Request.Context(), req.Email, req.Password)
		if err != nil {
			if err == auth.ErrInvalidCredentials {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
				return
			}
			if err == auth.ErrEmailNotVerified {
				c.JSON(http.StatusForbidden, gin.H{"error": "email not verified"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to login"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"user":   user,
			"tokens": tokens,
		})
	}
}

func refreshHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			RefreshToken string `json:"refresh_token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tokens, err := authService.RefreshTokens(c.Request.Context(), req.RefreshToken)
		if err != nil {
			if err == auth.ErrTokenExpired || err == auth.ErrTokenInvalid {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh"})
			return
		}

		c.JSON(http.StatusOK, tokens)
	}
}

func logoutHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			RefreshToken string `json:"refresh_token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := authService.Logout(c.Request.Context(), req.RefreshToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to logout"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "logged out"})
	}
}

func meHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, _ := c.Get("user_id")
		userID, err := parseUUID(userIDStr.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		user, err := authService.GetUser(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(http.StatusOK, user)
	}
}

func updateMeHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, _ := c.Get("user_id")
		userID, err := parseUUID(userIDStr.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		var req map[string]interface{}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, err := authService.UpdateUser(c.Request.Context(), userID, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
			return
		}

		c.JSON(http.StatusOK, user)
	}
}

func googleAuthHandler(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		state := c.Query("state")
		if state == "" {
			state = "discord2"
		}
		url := authService.GetGoogleAuthURL(state)
		if url == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "Google OAuth not configured"})
			return
		}
		c.Redirect(http.StatusTemporaryRedirect, url)
	}
}

func googleCallbackHandler(authService *auth.Service, frontendURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
			return
		}

		_, tokens, err := authService.HandleGoogleCallback(c.Request.Context(), code)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "oauth failed"})
			return
		}

		redirectURL := frontendURL + "/auth/callback?access_token=" + tokens.AccessToken + "&refresh_token=" + tokens.RefreshToken
		c.Redirect(http.StatusTemporaryRedirect, redirectURL)
	}
}

func listServersHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, _ := c.Get("user_id")
		userID, _ := parseUUID(userIDStr.(string))

		rows, err := db.Pool.Query(c.Request.Context(), `
			SELECT s.id, s.name, s.description, s.icon_url, s.banner_url, s.owner_id, s.verification_level, s.default_notifications, s.created_at, s.updated_at
			FROM servers s
			JOIN server_members sm ON s.id = sm.server_id
			WHERE sm.user_id = $1
			ORDER BY sm.joined_at
		`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list servers"})
			return
		}
		defer rows.Close()

		type Server struct {
			ID                   string  `json:"id"`
			Name                 string  `json:"name"`
			Description          *string `json:"description"`
			IconURL              *string `json:"icon_url"`
			BannerURL            *string `json:"banner_url"`
			OwnerID              string  `json:"owner_id"`
			VerificationLevel    int     `json:"verification_level"`
			DefaultNotifications int     `json:"default_notifications"`
			CreatedAt            string  `json:"created_at"`
			UpdatedAt            string  `json:"updated_at"`
		}

		var servers []Server = []Server{}
		for rows.Next() {
			var s Server
			var desc, icon, banner sql.NullString
			var createdAt, updatedAt time.Time
			err := rows.Scan(&s.ID, &s.Name, &desc, &icon, &banner, &s.OwnerID, &s.VerificationLevel, &s.DefaultNotifications, &createdAt, &updatedAt)
			if err != nil {
				continue
			}
			s.CreatedAt = createdAt.Format(time.RFC3339)
			s.UpdatedAt = updatedAt.Format(time.RFC3339)
			if desc.Valid { s.Description = &desc.String }
			if icon.Valid { s.IconURL = &icon.String }
			if banner.Valid { s.BannerURL = &banner.String }
			servers = append(servers, s)
		}

		c.JSON(http.StatusOK, servers)
	}
}

func createServerHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, _ := c.Get("user_id")
		userID, _ := parseUUID(userIDStr.(string))

		var req struct {
			Name        string  `json:"name" binding:"required,min=1,max=100"`
			Description *string `json:"description"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		serverID := uuid.New()
		_, err := db.Pool.Exec(c.Request.Context(), `
			INSERT INTO servers (id, name, description, owner_id)
			VALUES ($1, $2, $3, $4)
		`, serverID, req.Name, req.Description, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create server"})
			return
		}

		_, err = db.Pool.Exec(c.Request.Context(), `
			INSERT INTO server_members (server_id, user_id, roles)
			VALUES ($1, $2, $3)
		`, serverID, userID, []uuid.UUID{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add owner"})
			return
		}

		generalChannelID := uuid.New()
		_, err = db.Pool.Exec(c.Request.Context(), `
			INSERT INTO channels (id, server_id, type, name, position)
			VALUES ($1, $2, 0, 'general', 0)
		`, generalChannelID, serverID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create general channel"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"id": serverID.String()})
	}
}

func getServerHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}

		var s struct {
			ID                   string  `json:"id"`
			Name                 string  `json:"name"`
			Description          *string `json:"description"`
			IconURL              *string `json:"icon_url"`
			BannerURL            *string `json:"banner_url"`
			OwnerID              string  `json:"owner_id"`
			VerificationLevel    int     `json:"verification_level"`
			DefaultNotifications int     `json:"default_notifications"`
			CreatedAt            string  `json:"created_at"`
			UpdatedAt            string  `json:"updated_at"`
		}
		var desc, icon, banner sql.NullString
		var createdAt, updatedAt time.Time
		err = db.Pool.QueryRow(c.Request.Context(), `
			SELECT id, name, description, icon_url, banner_url, owner_id, verification_level, default_notifications, created_at, updated_at
			FROM servers WHERE id = $1
		`, serverID).Scan(&s.ID, &s.Name, &desc, &icon, &banner, &s.OwnerID, &s.VerificationLevel, &s.DefaultNotifications, &createdAt, &updatedAt)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
			return
		}
		s.CreatedAt = createdAt.Format(time.RFC3339)
		s.UpdatedAt = updatedAt.Format(time.RFC3339)
		if desc.Valid { s.Description = &desc.String }
		if icon.Valid { s.IconURL = &icon.String }
		if banner.Valid { s.BannerURL = &banner.String }

		c.JSON(http.StatusOK, s)
	}
}

func updateServerHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
	}
}

func deleteServerHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
	}
}

func listChannelsHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}

		rows, err := db.Pool.Query(c.Request.Context(), `
			SELECT id, server_id, type, name, topic, position, parent_id, nsfw, rate_limit_per_user, created_at, updated_at
			FROM channels WHERE server_id = $1 ORDER BY position
		`, serverID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list channels"})
			return
		}
		defer rows.Close()

		type Channel struct {
			ID                string  `json:"id"`
			ServerID          string  `json:"server_id"`
			Type              int     `json:"type"`
			Name              string  `json:"name"`
			Topic             *string `json:"topic"`
			Position          int     `json:"position"`
			ParentID          *string `json:"parent_id"`
			NSFW              bool    `json:"nsfw"`
			RateLimitPerUser  int     `json:"rate_limit_per_user"`
			CreatedAt         string  `json:"created_at"`
			UpdatedAt         string  `json:"updated_at"`
		}

		var channels []Channel = []Channel{}
		for rows.Next() {
			var ch Channel
			var topic, parentID sql.NullString
			var createdAt, updatedAt time.Time
			err := rows.Scan(&ch.ID, &ch.ServerID, &ch.Type, &ch.Name, &topic, &ch.Position, &parentID, &ch.NSFW, &ch.RateLimitPerUser, &createdAt, &updatedAt)
			if err != nil {
				continue
			}
			ch.CreatedAt = createdAt.Format(time.RFC3339)
			ch.UpdatedAt = updatedAt.Format(time.RFC3339)
			if topic.Valid { ch.Topic = &topic.String }
			if parentID.Valid { ch.ParentID = &parentID.String }
			channels = append(channels, ch)
		}

		c.JSON(http.StatusOK, channels)
	}
}

func createChannelHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}

		var req struct {
			Type     int     `json:"type"`
			Name     string  `json:"name" binding:"required,min=1,max=100"`
			Topic    *string `json:"topic"`
			ParentID *string `json:"parent_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Type < 0 || req.Type > 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel type"})
			return
		}

		channelID := uuid.New()
		var parentID *uuid.UUID
		if req.ParentID != nil {
			pid, _ := parseUUID(*req.ParentID)
			parentID = &pid
		}

		_, err = db.Pool.Exec(c.Request.Context(), `
			INSERT INTO channels (id, server_id, type, name, topic, parent_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, channelID, serverID, req.Type, req.Name, req.Topic, parentID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create channel"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"id": channelID.String()})
	}
}

func listMembersHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}

		rows, err := database.Pool.Query(c.Request.Context(), `
			SELECT sm.user_id, sm.nickname, sm.roles, sm.joined_at,
			       u.username, u.display_name, u.avatar_url, u.status
			FROM server_members sm
			JOIN users u ON u.id = sm.user_id
			WHERE sm.server_id = $1
			ORDER BY sm.joined_at
		`, serverID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
			return
		}
		defer rows.Close()

		type Member struct {
			ServerID  string   `json:"server_id"`
			UserID    string   `json:"user_id"`
			Nickname  *string  `json:"nickname"`
			Roles     []string `json:"roles"`
			JoinedAt  string   `json:"joined_at"`
			User      gin.H    `json:"user"`
		}

		members := []Member{}
		for rows.Next() {
			var m Member
			var nickname, username, displayName, avatarURL, status sql.NullString
			var roles []string
			var joinedAt time.Time
			if err := rows.Scan(&m.UserID, &nickname, &roles, &joinedAt, &username, &displayName, &avatarURL, &status); err != nil {
				continue
			}
			m.ServerID = serverID.String()
			m.JoinedAt = joinedAt.Format(time.RFC3339)
			if nickname.Valid {
				m.Nickname = &nickname.String
			}
			if roles == nil {
				m.Roles = []string{}
			} else {
				m.Roles = roles
			}
			user := gin.H{"id": m.UserID, "username": username.String}
			if displayName.Valid {
				user["display_name"] = displayName.String
			}
			if avatarURL.Valid {
				user["avatar_url"] = avatarURL.String
			}
			user["status"] = status.String
			m.User = user
			members = append(members, m)
		}

		c.JSON(http.StatusOK, members)
	}
}

func addMemberHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}

		var req struct {
			UserID string `json:"user_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id required"})
			return
		}
		targetID, err := parseUUID(req.UserID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		_, err = database.Pool.Exec(c.Request.Context(), `
			INSERT INTO server_members (server_id, user_id, roles)
			VALUES ($1, $2, '{}')
			ON CONFLICT (server_id, user_id) DO NOTHING
		`, serverID, targetID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"server_id": serverID.String(), "user_id": targetID.String()})
	}
}

func removeMemberHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}
		targetID, err := parseUUID(c.Param("user_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}

		_, err = database.Pool.Exec(c.Request.Context(), `
			DELETE FROM server_members WHERE server_id = $1 AND user_id = $2
		`, serverID, targetID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "removed"})
	}
}

func updateMemberHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		serverID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
			return
		}

		var req struct {
			Nickname *string   `json:"nickname"`
			Roles    []string  `json:"roles"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.Nickname != nil {
			_, err = database.Pool.Exec(c.Request.Context(), `
				UPDATE server_members SET nickname = $1 WHERE server_id = $2 AND user_id = $3
			`, *req.Nickname, serverID, userIDFromCtx(c))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member"})
				return
			}
		}
		if req.Roles != nil {
			_, err = database.Pool.Exec(c.Request.Context(), `
				UPDATE server_members SET roles = $1 WHERE server_id = $2 AND user_id = $3
			`, req.Roles, serverID, userIDFromCtx(c))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member"})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"message": "updated"})
	}
}

func listVoiceStatesHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := database.Pool.Query(c.Request.Context(), `
			SELECT vs.user_id, vs.server_id, vs.channel_id, vs.session_id,
			       vs.self_mute, vs.self_deaf, vs.self_video, vs.self_stream, vs.joined_at,
			       u.username, u.display_name, u.avatar_url, u.status
			FROM voice_states vs
			JOIN users u ON u.id = vs.user_id
			ORDER BY vs.joined_at
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list voice states"})
			return
		}
		defer rows.Close()

		states := []gin.H{}
		for rows.Next() {
			var userID, serverID, channelID, sessionID, username, displayName, avatarURL, status sql.NullString
			var selfMute, selfDeaf, selfVideo, selfStream bool
			var joinedAt time.Time
			if err := rows.Scan(&userID, &serverID, &channelID, &sessionID, &selfMute, &selfDeaf, &selfVideo, &selfStream, &joinedAt, &username, &displayName, &avatarURL, &status); err != nil {
				continue
			}
			user := gin.H{"id": userID.String, "username": username.String, "status": status.String}
			if displayName.Valid {
				user["display_name"] = displayName.String
			}
			if avatarURL.Valid {
				user["avatar_url"] = avatarURL.String
			}
			states = append(states, gin.H{
				"user_id":      userID.String,
				"server_id":    serverID.String,
				"channel_id":   channelID.String,
				"session_id":   sessionID.String,
				"self_mute":    selfMute,
				"self_deaf":    selfDeaf,
				"self_video":   selfVideo,
				"self_stream":  selfStream,
				"joined_at":    joinedAt.Format(time.RFC3339),
				"user":         user,
			})
		}

		c.JSON(http.StatusOK, states)
	}
}

func getChannelHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		channelID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
			return
		}

		ch, err := getChannelRow(c.Request.Context(), database, channelID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
			return
		}

		c.JSON(http.StatusOK, ch)
	}
}

func updateChannelHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		channelID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
			return
		}

		var req struct {
			Name     *string `json:"name"`
			Topic    *string `json:"topic"`
			NSFW     *bool   `json:"nsfw"`
			Position *int    `json:"position"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		setParts := []string{}
		args := []interface{}{}
		idx := 1
		if req.Name != nil {
			setParts = append(setParts, fmt.Sprintf("name=$%d", idx))
			args = append(args, *req.Name)
			idx++
		}
		if req.Topic != nil {
			setParts = append(setParts, fmt.Sprintf("topic=$%d", idx))
			args = append(args, *req.Topic)
			idx++
		}
		if req.NSFW != nil {
			setParts = append(setParts, fmt.Sprintf("nsfw=$%d", idx))
			args = append(args, *req.NSFW)
			idx++
		}
		if req.Position != nil {
			setParts = append(setParts, fmt.Sprintf("position=$%d", idx))
			args = append(args, *req.Position)
			idx++
		}
		if len(setParts) == 0 {
			ch, _ := getChannelRow(c.Request.Context(), database, channelID)
			c.JSON(http.StatusOK, ch)
			return
		}
		setParts = append(setParts, "updated_at=NOW()")
		args = append(args, channelID)
		query := fmt.Sprintf("UPDATE channels SET %s WHERE id=$%d", joinParts(setParts), idx)
		if _, err := database.Pool.Exec(c.Request.Context(), query, args...); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update channel"})
			return
		}

		ch, _ := getChannelRow(c.Request.Context(), database, channelID)
		c.JSON(http.StatusOK, ch)
	}
}

func deleteChannelHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		channelID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
			return
		}

		if _, err := database.Pool.Exec(c.Request.Context(), `DELETE FROM channels WHERE id = $1`, channelID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete channel"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "deleted"})
	}
}

func listMessagesHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		channelID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
			return
		}

		if !isChannelMember(c.Request.Context(), database, channelID, userID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this channel"})
			return
		}

		limit := 50
		if l := c.Query("limit"); l != "" {
			if _, err := fmt.Sscanf(l, "%d", &limit); err == nil {
				if limit <= 0 || limit > 100 {
					limit = 50
				}
			}
		}

		query := `SELECT id FROM messages WHERE channel_id = $1`
		args := []interface{}{channelID}
		if before := c.Query("before"); before != "" {
			if bid, err := parseUUID(before); err == nil {
				query += ` AND created_at < (SELECT created_at FROM messages WHERE id = $2)`
				args = append(args, bid)
			}
		}
		query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d`, len(args)+1)
		args = append(args, limit)

		rows, err := database.Pool.Query(c.Request.Context(), query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages"})
			return
		}
		defer rows.Close()

		var ids []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err == nil {
				ids = append(ids, id)
			}
		}

		out := make([]gin.H, 0, len(ids))
		for i := len(ids) - 1; i >= 0; i-- {
			if msg, err := buildMessageJSON(c.Request.Context(), database, ids[i], userID); err == nil {
				out = append(out, msg)
			}
		}

		c.JSON(http.StatusOK, out)
	}
}

func createMessageHandler(database *db.DB, hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		channelID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel id"})
			return
		}

		var req struct {
			Content            string  `json:"content" binding:"required"`
			ReferenceMessageID *string `json:"reference_message_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content required"})
			return
		}
		if len(req.Content) == 0 || len(req.Content) > 4000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content length"})
			return
		}

		if !isChannelMember(c.Request.Context(), database, channelID, userID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this channel"})
			return
		}

		var refID *uuid.UUID
		if req.ReferenceMessageID != nil {
			if rid, err := parseUUID(*req.ReferenceMessageID); err == nil {
				refID = &rid
			}
		}

		messageID := uuid.New()
		_, err = database.Pool.Exec(c.Request.Context(), `
			INSERT INTO messages (id, channel_id, author_id, content, type, reference_message_id, channel_type)
			VALUES ($1, $2, $3, $4, 0, $5, (SELECT type FROM channels WHERE id = $2))
		`, messageID, channelID, userID, req.Content, refID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create message"})
			return
		}

		msgJSON, err := buildMessageJSON(c.Request.Context(), database, messageID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load message"})
			return
		}

		hub.SendToChannel(channelID, &ws.Message{
			Op: ws.OpMessageEvent,
			Data: map[string]interface{}{
				"message":    msgJSON,
				"channel_id": channelID.String(),
			},
		}, &userID)

		c.JSON(http.StatusCreated, msgJSON)
	}
}

func getMessageHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		messageID, err := parseUUID(c.Param("message_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
			return
		}

		msg, err := buildMessageJSON(c.Request.Context(), database, messageID, userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
			return
		}

		c.JSON(http.StatusOK, msg)
	}
}

func updateMessageHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		messageID, err := parseUUID(c.Param("message_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
			return
		}

		var req struct {
			Content string `json:"content" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content required"})
			return
		}
		if len(req.Content) == 0 || len(req.Content) > 4000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content length"})
			return
		}

		res, err := database.Pool.Exec(c.Request.Context(), `
			UPDATE messages SET content = $1, edited_at = NOW()
			WHERE id = $2 AND author_id = $3
		`, req.Content, messageID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update message"})
			return
		}
		if rows := res.RowsAffected(); rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "message not found or not authorized"})
			return
		}

		msg, _ := buildMessageJSON(c.Request.Context(), database, messageID, userID)
		c.JSON(http.StatusOK, msg)
	}
}

func deleteMessageHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		messageID, err := parseUUID(c.Param("message_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
			return
		}

		res, err := database.Pool.Exec(c.Request.Context(), `
			DELETE FROM messages WHERE id = $1 AND author_id = $2
		`, messageID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete message"})
			return
		}
		if rows := res.RowsAffected(); rows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "message not found or not authorized"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "deleted", "id": messageID.String()})
	}
}

func addReactionHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		messageID, err := parseUUID(c.Param("message_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
			return
		}

		var req struct {
			Emoji string `json:"emoji" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "emoji required"})
			return
		}

		_, err = database.Pool.Exec(c.Request.Context(), `
			INSERT INTO message_reactions (message_id, user_id, emoji)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, messageID, userID, req.Emoji)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add reaction"})
			return
		}

		reactions, _ := getReactionsList(c.Request.Context(), database, messageID)
		c.JSON(http.StatusOK, gin.H{"reactions": reactions})
	}
}

func removeReactionHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		messageID, err := parseUUID(c.Param("message_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
			return
		}
		emoji := c.Param("emoji")

		_, err = database.Pool.Exec(c.Request.Context(), `
			DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3
		`, messageID, userID, emoji)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove reaction"})
			return
		}

		reactions, _ := getReactionsList(c.Request.Context(), database, messageID)
		c.JSON(http.StatusOK, gin.H{"reactions": reactions})
	}
}

func listDMsHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)

		rows, err := database.Pool.Query(c.Request.Context(), `
			SELECT dc.id, dc.type, dc.name, dc.icon_url, dc.owner_id, dc.created_at
			FROM dm_channels dc
			JOIN dm_participants dp ON dp.dm_channel_id = dc.id
			WHERE dp.user_id = $1
			ORDER BY dc.created_at DESC
		`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list dms"})
			return
		}
		defer rows.Close()

		type DM struct {
			ID        string   `json:"id"`
			Type      int      `json:"type"`
			Name      *string  `json:"name"`
			IconURL   *string  `json:"icon_url"`
			OwnerID   *string  `json:"owner_id"`
			CreatedAt string   `json:"created_at"`
			Participants []gin.H `json:"participants"`
		}

		dms := []DM{}
		for rows.Next() {
			var dm DM
			var name, iconURL, ownerID sql.NullString
			var createdAt time.Time
			if err := rows.Scan(&dm.ID, &dm.Type, &name, &iconURL, &ownerID, &createdAt); err != nil {
				continue
			}
			dm.CreatedAt = createdAt.Format(time.RFC3339)
			if name.Valid {
				dm.Name = &name.String
			}
			if iconURL.Valid {
				dm.IconURL = &iconURL.String
			}
			if ownerID.Valid {
				dm.OwnerID = &ownerID.String
			}
			dms = append(dms, dm)
		}

		for i := range dms {
			dms[i].Participants = getDMParticipants(c.Request.Context(), database, uuid.MustParse(dms[i].ID))
		}

		c.JSON(http.StatusOK, dms)
	}
}

func createDMHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)

		var req struct {
			UserID  string   `json:"user_id"`
			UserIDs []string `json:"user_ids"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.UserID != "" {
			req.UserIDs = append(req.UserIDs, req.UserID)
		}
		if len(req.UserIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "at least one user_id required"})
			return
		}

		participantIDs := []uuid.UUID{userID}
		for _, id := range req.UserIDs {
			if pid, err := parseUUID(id); err == nil && pid != userID {
				participantIDs = append(participantIDs, pid)
			}
		}

		// For 1:1 DMs, reuse an existing channel if present
		if len(participantIDs) == 2 {
			var existingID string
			err := database.Pool.QueryRow(c.Request.Context(), `
				SELECT dc.id FROM dm_channels dc
				WHERE dc.type = 3
				  AND dc.id IN (SELECT dm_channel_id FROM dm_participants WHERE user_id = $1)
				  AND dc.id IN (SELECT dm_channel_id FROM dm_participants WHERE user_id = $2)
				LIMIT 1
			`, participantIDs[0], participantIDs[1]).Scan(&existingID)
			if err == nil {
				dm := buildDMRow(c.Request.Context(), database, uuid.MustParse(existingID))
				c.JSON(http.StatusOK, dm)
				return
			}
		}

		dmType := 3
		if len(participantIDs) > 2 {
			dmType = 4
		}

		dmID := uuid.New()
		if _, err := database.Pool.Exec(c.Request.Context(), `
			INSERT INTO dm_channels (id, type, owner_id) VALUES ($1, $2, $3)
		`, dmID, dmType, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create dm"})
			return
		}
		for _, pid := range participantIDs {
			database.Pool.Exec(c.Request.Context(), `
				INSERT INTO dm_participants (dm_channel_id, user_id) VALUES ($1, $2)
				ON CONFLICT DO NOTHING
			`, dmID, pid)
		}

		dm := buildDMRow(c.Request.Context(), database, dmID)
		c.JSON(http.StatusCreated, dm)
	}
}

func getDMHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		dmID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dm id"})
			return
		}

		dm := buildDMRow(c.Request.Context(), database, dmID)
		if dm == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "dm not found"})
			return
		}

		c.JSON(http.StatusOK, dm)
	}
}

func createDMMessageHandler(database *db.DB, hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		dmID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dm id"})
			return
		}

		var req struct {
			Content string `json:"content" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content required"})
			return
		}
		if len(req.Content) == 0 || len(req.Content) > 4000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content length"})
			return
		}

		var isParticipant bool
		database.Pool.QueryRow(c.Request.Context(), `
			SELECT EXISTS(SELECT 1 FROM dm_participants WHERE dm_channel_id = $1 AND user_id = $2)
		`, dmID, userID).Scan(&isParticipant)
		if !isParticipant {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a participant"})
			return
		}

		messageID := uuid.New()
		_, err = database.Pool.Exec(c.Request.Context(), `
			INSERT INTO messages (id, dm_channel_id, author_id, content, type, channel_type)
			VALUES ($1, $2, $3, $4, 0, (SELECT type FROM dm_channels WHERE id = $2))
		`, messageID, dmID, userID, req.Content)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create message"})
			return
		}

		msgJSON, err := buildMessageJSON(c.Request.Context(), database, messageID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load message"})
			return
		}

		hub.SendToDM(dmID, &ws.Message{
			Op: ws.OpMessageEvent,
			Data: map[string]interface{}{
				"message":      msgJSON,
				"channel_id":   dmID.String(),
				"dm_channel_id": dmID.String(),
			},
		}, &userID)

		c.JSON(http.StatusCreated, msgJSON)
	}
}

func listDMMessagesHandler(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := userIDFromCtx(c)
		dmID, err := parseUUID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dm id"})
			return
		}

		var isParticipant bool
		database.Pool.QueryRow(c.Request.Context(), `
			SELECT EXISTS(SELECT 1 FROM dm_participants WHERE dm_channel_id = $1 AND user_id = $2)
		`, dmID, userID).Scan(&isParticipant)
		if !isParticipant {
			c.JSON(http.StatusForbidden, gin.H{"error": "not a participant"})
			return
		}

		limit := 50
		if l := c.Query("limit"); l != "" {
			if _, err := fmt.Sscanf(l, "%d", &limit); err == nil {
				if limit <= 0 || limit > 100 {
					limit = 50
				}
			}
		}

		query := `SELECT id FROM messages WHERE dm_channel_id = $1`
		args := []interface{}{dmID}
		if before := c.Query("before"); before != "" {
			if bid, err := parseUUID(before); err == nil {
				query += ` AND created_at < (SELECT created_at FROM messages WHERE id = $2)`
				args = append(args, bid)
			}
		}
		query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d`, len(args)+1)
		args = append(args, limit)

		rows, err := database.Pool.Query(c.Request.Context(), query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages"})
			return
		}
		defer rows.Close()

		var ids []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err == nil {
				ids = append(ids, id)
			}
		}

		out := make([]gin.H, 0, len(ids))
		for i := len(ids) - 1; i >= 0; i-- {
			if msg, err := buildMessageJSON(c.Request.Context(), database, ids[i], userID); err == nil {
				out = append(out, msg)
			}
		}

		c.JSON(http.StatusOK, out)
	}
}

func getVoiceTokenHandler(livekitCfg config.LiveKitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if livekitCfg.APIKey == "" || livekitCfg.APISecret == "" || livekitCfg.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}

		var req struct {
			ChannelID string `json:"channel_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "channel_id is required"})
			return
		}

		userID, ok := c.MustGet("user_id").(string)
		if !ok || userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		username, _ := c.MustGet("username").(string)

		roomName := "voice-" + req.ChannelID

		at := lkauth.NewAccessToken(livekitCfg.APIKey, livekitCfg.APISecret)
		at.SetIdentity(userID)
		at.SetName(username)

		allow := true
		grant := &lkauth.VideoGrant{
			RoomJoin:        true,
			Room:            roomName,
			CanPublish:      &allow,
			CanSubscribe:    &allow,
			CanPublishData:  &allow,
			CanUpdateOwnMetadata: &allow,
		}
		at.AddGrant(grant)

		jwt, err := at.ToJWT()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create voice token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token":     jwt,
			"ws_url":    livekitCfg.WSURL,
			"room_name": roomName,
		})
	}
}

func startOneToOneCallHandler(svc *calls.Service, lk config.LiveKitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if lk.APIKey == "" || lk.APISecret == "" || lk.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}

		var req struct {
			TargetUserID string `json:"target_user_id"`
			Type         string `json:"type"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.TargetUserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "target_user_id is required"})
			return
		}
		if req.Type != "voice" && req.Type != "video" {
			req.Type = "voice"
		}

		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		call, token, err := svc.Start(userID, "", "", []string{req.TargetUserID}, req.Type, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"call":       toCallResponse(call),
			"token":      token,
			"ws_url":     lk.WSURL,
			"room_name":  call.LivekitRoomName,
		})
	}
}

func startGroupCallHandler(svc *calls.Service, lk config.LiveKitConfig, database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if lk.APIKey == "" || lk.APISecret == "" || lk.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}

		var req struct {
			ChannelID string `json:"channel_id"`
			Type      string `json:"type"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "channel_id is required"})
			return
		}
		if req.Type != "voice" && req.Type != "video" {
			req.Type = "voice"
		}

		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		participants := svc.ChannelMembers(req.ChannelID)
		call, token, err := svc.Start(userID, req.ChannelID, "", participants, req.Type, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"call":      toCallResponse(call),
			"token":     token,
			"ws_url":    lk.WSURL,
			"room_name": call.LivekitRoomName,
		})
	}
}

func acceptCallHandler(svc *calls.Service, lk config.LiveKitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if lk.APIKey == "" || lk.APISecret == "" || lk.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}

		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		call, token, err := svc.Accept(callID, userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"call":      toCallResponse(call),
			"token":     token,
			"ws_url":    lk.WSURL,
			"room_name": call.LivekitRoomName,
		})
	}
}

func declineCallHandler(svc *calls.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if err := svc.Decline(callID, userID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

func endCallHandler(svc *calls.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if err := svc.End(callID, userID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

func callTokenHandler(svc *calls.Service, lk config.LiveKitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if lk.APIKey == "" || lk.APISecret == "" || lk.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}
		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		token, err := svc.TokenFor(callID, userID, true)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"token": token, "ws_url": lk.WSURL})
	}
}

func listActiveCallsHandler(svc *calls.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		callsList := svc.ListActive(userID)
		out := make([]map[string]interface{}, 0, len(callsList))
		for _, call := range callsList {
			out = append(out, toCallResponse(call))
		}
		c.JSON(http.StatusOK, gin.H{"calls": out})
	}
}

func startLiveHandler(svc *calls.Service, lk config.LiveKitConfig, database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if lk.APIKey == "" || lk.APISecret == "" || lk.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}

		var req struct {
			ChannelID string `json:"channel_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "channel_id is required"})
			return
		}

		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		participants := svc.ChannelMembers(req.ChannelID)
		call, token, err := svc.Start(userID, req.ChannelID, "", participants, "video", true)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"call":      toCallResponse(call),
			"token":     token,
			"ws_url":    lk.WSURL,
			"room_name": call.LivekitRoomName,
		})
	}
}

func endLiveHandler(svc *calls.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if err := svc.End(callID, userID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

func liveTokenHandler(svc *calls.Service, lk config.LiveKitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if lk.APIKey == "" || lk.APISecret == "" || lk.WSURL == "" {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "livekit voice not configured"})
			return
		}
		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		// Viewers may subscribe but not publish.
		token, err := svc.TokenFor(callID, userID, false)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"token": token, "ws_url": lk.WSURL})
	}
}

func listLiveViewersHandler(svc *calls.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		callID := c.Param("id")
		userID, _ := c.MustGet("user_id").(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		callsList := svc.ListActive(userID)
		for _, call := range callsList {
			if call.ID == callID {
				c.JSON(http.StatusOK, gin.H{"call": toCallResponse(call), "viewers": call.ParticipantIDs})
				return
			}
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "live stream not found"})
	}
}

func toCallResponse(call *calls.Call) map[string]interface{} {
	return map[string]interface{}{
		"id":                call.ID,
		"channel_id":       call.ChannelID,
		"dm_channel_id":    call.DMChannelID,
		"initiator_id":     call.InitiatorID,
		"participants":     call.ParticipantIDs,
		"type":             call.Type,
		"livekit_room_name": call.LivekitRoomName,
		"status":           call.Status,
		"is_live":          call.IsLive,
		"started_at":       call.CreatedAt,
	}
}

func websocketHandler(hub *ws.Hub, authService *auth.Service, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		claims, err := authService.ValidateAccessToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		userID, _ := parseUUID(claims.UserID)

		upgrader := websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			logger.Error("websocket upgrade failed", zap.Error(err))
			return
		}

		client := ws.NewClient(hub, conn, userID)
		hub.Register(client)

		go client.WritePump()
		client.ReadPump()
	}
}

func getUserHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
	}
}

func searchUsersHandler(db *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
	}
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func userIDFromCtx(c *gin.Context) uuid.UUID {
	v, _ := c.Get("user_id")
	if s, ok := v.(string); ok {
		if id, err := parseUUID(s); err == nil {
			return id
		}
	}
	return uuid.Nil
}

func joinParts(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}

func getPublicUser(ctx context.Context, database *db.DB, userID uuid.UUID) (gin.H, error) {
	var id, username, status string
	var displayName, avatarURL sql.NullString
	var emailVerified bool
	err := database.Pool.QueryRow(ctx, `
		SELECT id, username, display_name, avatar_url, status, email_verified
		FROM users WHERE id = $1
	`, userID).Scan(&id, &username, &displayName, &avatarURL, &status, &emailVerified)
	if err != nil {
		return nil, err
	}
	user := gin.H{"id": id, "username": username, "status": status, "email_verified": emailVerified}
	if displayName.Valid {
		user["display_name"] = displayName.String
	}
	if avatarURL.Valid {
		user["avatar_url"] = avatarURL.String
	}
	return user, nil
}

func getReactionsList(ctx context.Context, database *db.DB, messageID uuid.UUID) ([]gin.H, error) {
	rows, err := database.Pool.Query(ctx, `
		SELECT message_id, user_id, emoji, created_at
		FROM message_reactions WHERE message_id = $1 ORDER BY created_at
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []gin.H{}
	for rows.Next() {
		var mid, uid, emoji string
		var createdAt time.Time
		if err := rows.Scan(&mid, &uid, &emoji, &createdAt); err != nil {
			continue
		}
		out = append(out, gin.H{
			"message_id":  mid,
			"user_id":     uid,
			"emoji":       emoji,
			"created_at":  createdAt.Format(time.RFC3339),
		})
	}
	return out, nil
}

func buildMessageJSON(ctx context.Context, database *db.DB, messageID, requestUserID uuid.UUID) (gin.H, error) {
	var id, authorID uuid.UUID
	var channelID, dmChannelID, refID uuid.NullUUID
	var content string
	var editedAt sql.NullString
	var msgType, channelType int
	var createdAt time.Time
	err := database.Pool.QueryRow(ctx, `
		SELECT id, channel_id, dm_channel_id, author_id, content, edited_at, type, reference_message_id, channel_type, created_at
		FROM messages WHERE id = $1
	`, messageID).Scan(&id, &channelID, &dmChannelID, &authorID, &content, &editedAt, &msgType, &refID, &channelType, &createdAt)
	if err != nil {
		return nil, err
	}

	author, err := getPublicUser(ctx, database, authorID)
	if err != nil {
		return nil, err
	}
	reactions, err := getReactionsList(ctx, database, messageID)
	if err != nil {
		return nil, err
	}

	msgChannel := channelID.UUID.String()
	if !channelID.Valid {
		msgChannel = dmChannelID.UUID.String()
	}

	msg := gin.H{
		"id":           id,
		"channel_id":   msgChannel,
		"author_id":    authorID,
		"author":       author,
		"content":      content,
		"type":         msgType,
		"channel_type": channelType,
		"attachments":  []gin.H{},
		"reactions":    reactions,
		"created_at":   createdAt.Format(time.RFC3339),
	}
	if editedAt.Valid {
		msg["edited_at"] = editedAt.String
	}
	if refID.Valid {
		msg["reference_message_id"] = refID.UUID.String()
	}
	return msg, nil
}

func getChannelRow(ctx context.Context, database *db.DB, channelID uuid.UUID) (gin.H, error) {
	var id, serverID uuid.UUID
	var name string
	var topic, parentID sql.NullString
	var chType, position, rateLimitPerUser int
	var nsfw bool
	var createdAt, updatedAt time.Time
	err := database.Pool.QueryRow(ctx, `
		SELECT id, server_id, type, name, topic, position, parent_id, nsfw, rate_limit_per_user, created_at, updated_at
		FROM channels WHERE id = $1
	`, channelID).Scan(&id, &serverID, &chType, &name, &topic, &position, &parentID, &nsfw, &rateLimitPerUser, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	ch := gin.H{
		"id":                   id.String(),
		"server_id":            serverID.String(),
		"type":                 chType,
		"name":                 name,
		"position":             position,
		"nsfw":                 nsfw,
		"rate_limit_per_user":  rateLimitPerUser,
		"created_at":           createdAt.Format(time.RFC3339),
		"updated_at":           updatedAt.Format(time.RFC3339),
	}
	if topic.Valid {
		ch["topic"] = topic.String
	}
	if parentID.Valid {
		ch["parent_id"] = parentID.String
	}
	return ch, nil
}

func isChannelMember(ctx context.Context, database *db.DB, channelID, userID uuid.UUID) bool {
	var serverID uuid.NullUUID
	database.Pool.QueryRow(ctx, `SELECT server_id FROM channels WHERE id = $1`, channelID).Scan(&serverID)
	if !serverID.Valid {
		return false
	}
	var isMember bool
	database.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2)
	`, serverID.UUID, userID).Scan(&isMember)
	return isMember
}

func getDMParticipants(ctx context.Context, database *db.DB, dmID uuid.UUID) []gin.H {
	rows, err := database.Pool.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, u.status
		FROM dm_participants dp
		JOIN users u ON u.id = dp.user_id
		WHERE dp.dm_channel_id = $1
	`, dmID)
	if err != nil {
		return []gin.H{}
	}
	defer rows.Close()

	out := []gin.H{}
	for rows.Next() {
		var id, username, status string
		var displayName, avatarURL sql.NullString
		if err := rows.Scan(&id, &username, &displayName, &avatarURL, &status); err != nil {
			continue
		}
		user := gin.H{"id": id, "username": username, "status": status}
		if displayName.Valid {
			user["display_name"] = displayName.String
		}
		if avatarURL.Valid {
			user["avatar_url"] = avatarURL.String
		}
		out = append(out, user)
	}
	return out
}

func buildDMRow(ctx context.Context, database *db.DB, dmID uuid.UUID) gin.H {
	var id string
	var dmType int
	var name, iconURL, ownerID sql.NullString
	var createdAt time.Time
	err := database.Pool.QueryRow(ctx, `
		SELECT id, type, name, icon_url, owner_id, created_at
		FROM dm_channels WHERE id = $1
	`, dmID).Scan(&id, &dmType, &name, &iconURL, &ownerID, &createdAt)
	if err != nil {
		return nil
	}
	dm := gin.H{
		"id":         id,
		"type":       dmType,
		"created_at": createdAt.Format(time.RFC3339),
	}
	if name.Valid {
		dm["name"] = name.String
	}
	if iconURL.Valid {
		dm["icon_url"] = iconURL.String
	}
	if ownerID.Valid {
		dm["owner_id"] = ownerID.String
	}
	dm["participants"] = getDMParticipants(ctx, database, dmID)
	return dm
}