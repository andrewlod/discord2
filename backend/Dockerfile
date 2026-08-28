FROM golang:1.27-alpine AS builder

RUN apk add --no-cache git make protobuf-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /discord2 ./cmd/server

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /discord2 .
COPY config.yaml .

EXPOSE 8080

CMD ["./discord2"]
