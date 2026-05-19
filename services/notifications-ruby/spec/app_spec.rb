# frozen_string_literal: true

# Smoke specs for the Sinatra app surface.
#
# These cover only routes that don't touch Redis: `/`, the health
# probe, and the prometheus metrics endpoint. The /readyz and POST
# /v1/notifications/send paths require a live Redis and live in the
# integration suite.

require_relative "spec_helper"

RSpec.describe NotificationsApp do
  include Rack::Test::Methods

  def app
    NotificationsApp
  end

  describe "GET /" do
    it "returns service identity json" do
      get "/"
      expect(last_response.status).to eq(200)
      body = JSON.parse(last_response.body)
      expect(body["service"]).to eq("leetrank-notifications-ruby")
      expect(body["version"]).to be_a(String)
    end
  end

  describe "GET /v1/notifications/health" do
    it "returns 200 with status ok" do
      get "/v1/notifications/health"
      expect(last_response.status).to eq(200)
      expect(last_response.headers["Content-Type"]).to include("application/json")
      body = JSON.parse(last_response.body)
      expect(body).to eq({ "status" => "ok" })
    end
  end

  describe "GET /v1/notifications/metrics" do
    it "returns prometheus text format" do
      get "/v1/notifications/metrics"
      expect(last_response.status).to eq(200)
      expect(last_response.headers["Content-Type"]).to include("text/plain")
      # The counter is registered at class load time even if never
      # incremented, so the # HELP / # TYPE banners must be present.
      expect(last_response.body).to include("notifications_http_requests_total")
    end
  end

  describe "error handling" do
    it "returns 400 with bad_request on invalid json POST body" do
      post "/v1/notifications/send", "{not-json", { "CONTENT_TYPE" => "application/json" }
      expect(last_response.status).to eq(400)
      body = JSON.parse(last_response.body)
      expect(body["error"]).to eq("bad_request")
    end
  end
end
