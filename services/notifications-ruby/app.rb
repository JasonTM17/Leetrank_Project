# LeetRank notifications-ruby — Sinatra service for outbound notifications.
#
# Endpoints:
#   POST /v1/notifications/send  -> enqueue
#   GET  /v1/notifications/health
#   GET  /v1/notifications/metrics  (prometheus)

require "sinatra/base"
require "json"
require "redis"
require "prometheus/client"
require "prometheus/client/formats/text"

require_relative "lib/queue"

class NotificationsApp < Sinatra::Base
  configure do
    set :show_exceptions, false
    set :raise_errors, false
    set :dump_errors, false
    enable :logging
  end

  PROMETHEUS = Prometheus::Client.registry
  REQ_COUNTER = PROMETHEUS.counter(
    :notifications_http_requests_total,
    docstring: "Total HTTP requests",
    labels: %i[route status]
  )
  ENQUEUE_COUNTER = PROMETHEUS.counter(
    :notifications_enqueued_total,
    docstring: "Total notifications enqueued",
    labels: %i[kind]
  )

  before do
    content_type :json
  end

  get "/" do
    REQ_COUNTER.increment(labels: { route: "/", status: "200" })
    { service: "leetrank-notifications-ruby", version: "0.1.0" }.to_json
  end

  get "/v1/notifications/health" do
    REQ_COUNTER.increment(labels: { route: "/v1/notifications/health", status: "200" })
    { status: "ok" }.to_json
  end

  get "/v1/notifications/readyz" do
    queue = NotificationsQueue.new
    queue.ping
    REQ_COUNTER.increment(labels: { route: "/v1/notifications/readyz", status: "200" })
    { status: "ready", queue_depth: queue.depth }.to_json
  rescue StandardError => e
    REQ_COUNTER.increment(labels: { route: "/v1/notifications/readyz", status: "503" })
    status 503
    { status: "unready", error: e.message }.to_json
  end

  get "/v1/notifications/metrics" do
    content_type "text/plain; version=0.0.4"
    Prometheus::Client::Formats::Text.marshal(PROMETHEUS)
  end

  post "/v1/notifications/send" do
    body = request.body.read
    payload = body.empty? ? {} : JSON.parse(body)
    kind = payload.fetch("kind") { halt_with(400, "kind required") }
    to = payload.fetch("to") { halt_with(400, "to required") }
    subject = payload["subject"].to_s
    text = payload["text"].to_s

    msg = {
      "id" => SecureRandom.uuid,
      "kind" => kind,
      "to" => to,
      "subject" => subject,
      "text" => text,
      "enqueued_at" => Time.now.utc.iso8601
    }

    NotificationsQueue.new.enqueue(msg)
    ENQUEUE_COUNTER.increment(labels: { kind: kind })
    REQ_COUNTER.increment(labels: { route: "POST /v1/notifications/send", status: "202" })

    status 202
    { id: msg["id"], status: "queued" }.to_json
  end

  error JSON::ParserError do
    REQ_COUNTER.increment(labels: { route: "error", status: "400" })
    status 400
    { error: "bad_request", message: "invalid json" }.to_json
  end

  error StandardError do
    e = env["sinatra.error"]
    REQ_COUNTER.increment(labels: { route: "error", status: "500" })
    status 500
    { error: "internal_error", message: e.message }.to_json
  end

  helpers do
    def halt_with(code, message)
      halt code, { error: "bad_request", message: message }.to_json
    end
  end
end

require "securerandom"
