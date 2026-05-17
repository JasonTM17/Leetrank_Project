#!/usr/bin/env ruby
# frozen_string_literal: true

# ruby_runner.rb — safe Ruby code executor for LeetRank judge service.
#
# Usage:
#   ruby ruby_runner.rb <code_file_path>
#   (test-case input is read from stdin)
#
# Output (stdout):
#   JSON: {"output":"...","error":"...","timed_out":false}

require 'json'
require 'open3'
require 'timeout'

TIMEOUT_SECONDS = (ENV['RUNNER_TIMEOUT'] || '5').to_i

def result(output: '', error: '', timed_out: false)
  puts JSON.generate({ output: output, error: error, timed_out: timed_out })
  $stdout.flush
end

def main
  if ARGV.empty?
    result(error: 'Usage: ruby_runner.rb <code_file>')
    return
  end

  code_file = ARGV[0]
  unless File.exist?(code_file)
    result(error: "Code file not found: #{code_file}")
    return
  end

  stdin_data = $stdin.read

  stdout_str = ''
  stderr_str = ''
  exit_status = nil

  begin
    Timeout.timeout(TIMEOUT_SECONDS) do
      stdout_str, stderr_str, status = Open3.capture3(
        RbConfig.ruby, code_file,
        stdin_data: stdin_data
      )
      exit_status = status.exitstatus
    end
  rescue Timeout::Error
    result(timed_out: true)
    return
  rescue => e
    result(error: "Runner error: #{e.message}")
    return
  end

  if exit_status != 0
    # Trim long backtraces to last 10 lines.
    lines = stderr_str.strip.split("\n")
    trimmed = lines.length > 10 ? lines.last(10).join("\n") : stderr_str.strip
    result(output: stdout_str, error: trimmed)
  else
    result(output: stdout_str)
  end
end

main
