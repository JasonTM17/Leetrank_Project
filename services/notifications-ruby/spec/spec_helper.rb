# frozen_string_literal: true

# Minimal RSpec config for the notifications-ruby app.
#
# We only exercise routes that don't touch Redis here — `/`, the
# health endpoint, and the prometheus /metrics endpoint. Anything
# that hits the queue (readyz, send) belongs in the integration
# suite where Redis is up.

ENV["RACK_ENV"] = "test"

require "rspec"
require "rack/test"
require_relative "../app"

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end
  config.example_status_persistence_file_path = ".rspec_status"
  config.disable_monkey_patching!
end
