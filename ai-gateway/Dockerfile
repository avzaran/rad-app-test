FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/ai-gateway ./cmd/gateway

FROM alpine:3.21
WORKDIR /app
COPY --from=build /bin/ai-gateway /usr/local/bin/ai-gateway
EXPOSE 8090
CMD ["ai-gateway"]
