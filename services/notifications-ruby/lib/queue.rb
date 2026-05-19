# Thin Redis-backed queue. We don't pull sidekiq for this — a single
# LPUSH/BRPOP queue is plenty for a background email fanout.

require "redis"
require "json"

class NotificationsQueue
  QUEUE_KEY = ENV.fetch("NOTIFICATIONS_QUEUE", "notifications:outbound")
  DLQ_KEY = ENV.fetch("NOTIFICATIONS_DLQ", "notifications:dlq")

  def initialize(redis: nil)
    @redis = redis || self.class.client
  end

  def self.client
    @client ||= Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))
  end

  def enqueue(payload)
    @redis.lpush(QUEUE_KEY, JSON.generate(payload))
  end

  def pop_blocking(timeout: 5)
    raw = @redis.brpop(QUEUE_KEY, timeout: timeout)
    return nil unless raw

    JSON.parse(raw[1])
  end

  def push_dlq(payload, error:)
    @redis.lpush(DLQ_KEY, JSON.generate(payload.merge("dlq_reason" => error.to_s)))
  end

  def depth
    @redis.llen(QUEUE_KEY)
  end

  def ping
    @redis.ping
  end
end
