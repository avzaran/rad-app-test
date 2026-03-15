package resilience

import (
	"errors"
	"sync"
	"time"
)

type CircuitBreaker struct {
	mu           sync.Mutex
	failureCount int
	openedAt     *time.Time
	threshold    int
	cooldown     time.Duration
}

func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		threshold: threshold,
		cooldown:  cooldown,
	}
}

func (cb *CircuitBreaker) Allow() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.openedAt == nil {
		return nil
	}

	if time.Since(*cb.openedAt) >= cb.cooldown {
		cb.openedAt = nil
		cb.failureCount = 0
		return nil
	}

	return errors.New("circuit open")
}

func (cb *CircuitBreaker) Success() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount = 0
	cb.openedAt = nil
}

func (cb *CircuitBreaker) Failure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount++
	if cb.failureCount >= cb.threshold {
		now := time.Now()
		cb.openedAt = &now
	}
}
