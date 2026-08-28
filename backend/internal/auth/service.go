package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"go.uber.org/zap"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"discord2/backend/internal/config"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserExists         = errors.New("user already exists")
	ErrUserNotFound       = errors.New("user not found")
	ErrTokenExpired       = errors.New("token expired")
	ErrTokenInvalid       = errors.New("token invalid")
	ErrEmailNotVerified   = errors.New("email not verified")
)

type Service struct {
	cfg      *config.Config
	db       *pgxpool.Pool
	logger   *zap.Logger
	oauth2   *oauth2.Config
}

type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

type User struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	Username      string    `json:"username"`
	DisplayName   *string   `json:"display_name"`
	AvatarURL     *string   `json:"avatar_url"`
	GoogleID      *string   `json:"google_id"`
	EmailVerified bool      `json:"email_verified"`
	PasswordHash  *string   `json:"-"`
	Status        string    `json:"status"`
	CustomStatus  *string   `json:"custom_status"`
	VideoQuality  string    `json:"video_quality"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func NewService(cfg *config.Config, db *pgxpool.Pool, logger *zap.Logger) *Service {
	s := &Service{
		cfg:    cfg,
		db:     db,
		logger: logger,
	}

	if cfg.GoogleOAuth.ClientID != "" && cfg.GoogleOAuth.ClientSecret != "" {
		s.oauth2 = &oauth2.Config{
			ClientID:     cfg.GoogleOAuth.ClientID,
			ClientSecret: cfg.GoogleOAuth.ClientSecret,
			RedirectURL:  cfg.GoogleOAuth.RedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}

	return s
}

func (s *Service) Register(ctx context.Context, email, username, password string) (*User, *TokenPair, error) {
	email = lowerTrim(email)
	username = lowerTrim(username)

	exists, err := s.userExists(ctx, email, username)
	if err != nil {
		return nil, nil, err
	}
	if exists {
		return nil, nil, ErrUserExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("hash password: %w", err)
	}

	hashStr := string(hash)
	user := &User{
		ID:            uuid.New(),
		Email:         email,
		Username:      username,
		PasswordHash:  &hashStr,
		EmailVerified: false,
		Status:        "online",
		VideoQuality:  "720p",
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO users (id, email, username, password_hash, email_verified, status, video_quality)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, user.ID, user.Email, user.Username, user.PasswordHash, user.EmailVerified, user.Status, user.VideoQuality)
	if err != nil {
		return nil, nil, fmt.Errorf("insert user: %w", err)
	}

	tokens, err := s.generateTokenPair(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	if fresh, ferr := s.getUserByID(ctx, user.ID); ferr == nil {
		user = fresh
	}

	return user, tokens, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (*User, *TokenPair, error) {
	email = lowerTrim(email)

	user, err := s.getUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, err
	}

	if user.PasswordHash == nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	if !user.EmailVerified {
		return nil, nil, ErrEmailNotVerified
	}

	tokens, err := s.generateTokenPair(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *Service) RefreshTokens(ctx context.Context, refreshToken string) (*TokenPair, error) {
	tokenHash := hashToken(refreshToken)

	var userID uuid.UUID
	var expiresAt time.Time
	err := s.db.QueryRow(ctx, `
		SELECT user_id, expires_at FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, tokenHash).Scan(&userID, &expiresAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTokenInvalid
		}
		return nil, err
	}

	if time.Now().After(expiresAt) {
		return nil, ErrTokenExpired
	}

	_, err = s.db.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, tokenHash)
	if err != nil {
		return nil, err
	}

	user, err := s.getUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return s.generateTokenPair(ctx, user)
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	tokenHash := hashToken(refreshToken)
	_, err := s.db.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *Service) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWT.Secret), nil
	})

	if err != nil {
		return nil, ErrTokenInvalid
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, ErrTokenInvalid
}

func (s *Service) GetGoogleAuthURL(state string) string {
	if s.oauth2 == nil {
		return ""
	}
	return s.oauth2.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func (s *Service) HandleGoogleCallback(ctx context.Context, code string) (*User, *TokenPair, error) {
	if s.oauth2 == nil {
		return nil, nil, errors.New("Google OAuth not configured")
	}

	token, err := s.oauth2.Exchange(ctx, code)
	if err != nil {
		return nil, nil, fmt.Errorf("exchange code: %w", err)
	}

	client := s.oauth2.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, nil, fmt.Errorf("get user info: %w", err)
	}
	defer resp.Body.Close()

	var googleUser struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		VerifiedEmail bool   `json:"verified_email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		return nil, nil, fmt.Errorf("decode user info: %w", err)
	}

	user, err := s.getUserByGoogleID(ctx, googleUser.ID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, err
	}

	if user == nil {
		user, err = s.getUserByEmail(ctx, googleUser.Email)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, err
		}
	}

	if user == nil {
		username := generateUsername(googleUser.Email)
		user = &User{
			ID:            uuid.New(),
			Email:         googleUser.Email,
			Username:      username,
			DisplayName:   &googleUser.Name,
			AvatarURL:     &googleUser.Picture,
			GoogleID:      &googleUser.ID,
			EmailVerified: googleUser.VerifiedEmail,
			Status:        "online",
			VideoQuality:  "720p",
		}
		_, err = s.db.Exec(ctx, `
			INSERT INTO users (id, email, username, display_name, avatar_url, google_id, email_verified, status, video_quality)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, user.ID, user.Email, user.Username, user.DisplayName, user.AvatarURL, user.GoogleID, user.EmailVerified, user.Status, user.VideoQuality)
		if err != nil {
			return nil, nil, fmt.Errorf("insert google user: %w", err)
		}
	} else if user.GoogleID == nil {
		_, err = s.db.Exec(ctx, `UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), display_name = COALESCE(display_name, $3), email_verified = $4 WHERE id = $5`,
			googleUser.ID, googleUser.Picture, googleUser.Name, googleUser.VerifiedEmail, user.ID)
		if err != nil {
			return nil, nil, err
		}
		user.GoogleID = &googleUser.ID
		if user.AvatarURL == nil {
			user.AvatarURL = &googleUser.Picture
		}
		if user.DisplayName == nil {
			user.DisplayName = &googleUser.Name
		}
		user.EmailVerified = googleUser.VerifiedEmail
	}

	tokens, err := s.generateTokenPair(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *Service) GetUser(ctx context.Context, userID uuid.UUID) (*User, error) {
	return s.getUserByID(ctx, userID)
}

func (s *Service) UpdateUser(ctx context.Context, userID uuid.UUID, updates map[string]interface{}) (*User, error) {
	if len(updates) == 0 {
		return s.getUserByID(ctx, userID)
	}

	setParts := []string{}
	args := []interface{}{}
	argIdx := 1

	allowedFields := map[string]bool{
		"username": true, "display_name": true, "avatar_url": true,
		"status": true, "custom_status": true,
		"video_quality": true, "preferred_camera": true,
		"preferred_microphone": true, "preferred_speaker": true,
		"noise_suppression": true, "echo_cancellation": true, "auto_gain_control": true,
	}

	for k, v := range updates {
		if !allowedFields[k] {
			continue
		}
		setParts = append(setParts, fmt.Sprintf("%s = $%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}

	if len(setParts) == 0 {
		return s.getUserByID(ctx, userID)
	}

	setParts = append(setParts, "updated_at = NOW()")
	args = append(args, userID)

	query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", join(setParts, ", "), argIdx)
	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return s.getUserByID(ctx, userID)
}

func (s *Service) generateTokenPair(ctx context.Context, user *User) (*TokenPair, error) {
	now := time.Now()
	accessExpires := now.Add(s.cfg.JWT.AccessTTL)
	refreshExpires := now.Add(s.cfg.JWT.RefreshTTL)

	accessClaims := &Claims{
		UserID:   user.ID.String(),
		Email:    user.Email,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.cfg.JWT.Issuer,
			Subject:   user.ID.String(),
			ExpiresAt: jwt.NewNumericDate(accessExpires),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	refreshTokenBytes := make([]byte, 32)
	if _, err := rand.Read(refreshTokenBytes); err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}
	refreshToken := hex.EncodeToString(refreshTokenBytes)
	refreshTokenHash := hashToken(refreshToken)

	_, err = s.db.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, user.ID, refreshTokenHash, refreshExpires)
	if err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.cfg.JWT.AccessTTL.Seconds()),
	}, nil
}

func (s *Service) userExists(ctx context.Context, email, username string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 OR username = $2)
	`, email, username).Scan(&exists)
	return exists, err
}

func (s *Service) getUserByEmail(ctx context.Context, email string) (*User, error) {
	return s.scanUser(s.db.QueryRow(ctx, `
		SELECT id, email, username, display_name, avatar_url, google_id, email_verified, password_hash, status, custom_status, video_quality, created_at, updated_at
		FROM users WHERE email = $1
	`, email))
}

func (s *Service) getUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return s.scanUser(s.db.QueryRow(ctx, `
		SELECT id, email, username, display_name, avatar_url, google_id, email_verified, password_hash, status, custom_status, video_quality, created_at, updated_at
		FROM users WHERE id = $1
	`, id))
}

func (s *Service) getUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
	return s.scanUser(s.db.QueryRow(ctx, `
		SELECT id, email, username, display_name, avatar_url, google_id, email_verified, password_hash, status, custom_status, video_quality, created_at, updated_at
		FROM users WHERE google_id = $1
	`, googleID))
}

func (s *Service) scanUser(row pgx.Row) (*User, error) {
	var u User
	var displayName, avatarURL, googleID, passwordHash, customStatus sql.NullString
	err := row.Scan(
		&u.ID, &u.Email, &u.Username, &displayName, &avatarURL, &googleID,
		&u.EmailVerified, &passwordHash, &u.Status, &customStatus, &u.VideoQuality,
		&u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if displayName.Valid { u.DisplayName = &displayName.String }
	if avatarURL.Valid { u.AvatarURL = &avatarURL.String }
	if googleID.Valid { u.GoogleID = &googleID.String }
	if passwordHash.Valid { u.PasswordHash = &passwordHash.String }
	if customStatus.Valid { u.CustomStatus = &customStatus.String }
	return &u, nil
}

func hashToken(token string) string {
	b := make([]byte, 32)
	copy(b, []byte(token))
	return hex.EncodeToString(b)
}

func lowerTrim(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func generateUsername(email string) string {
	base := strings.Split(email, "@")[0]
	base = regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(base, "")
	if len(base) > 32 { base = base[:32] }
	if len(base) < 3 { base = base + "user" }
	return strings.ToLower(base) + "_" + randomString(4)
}

func randomString(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)[:n]
}

func join(strs []string, sep string) string {
	if len(strs) == 0 { return "" }
	result := strs[0]
	for _, s := range strs[1:] {
		result += sep + s
	}
	return result
}