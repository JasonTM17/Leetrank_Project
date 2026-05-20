# LeetRank notifications-ruby worker.
#
# Pulls JSON payloads from Redis (LPUSH/BRPOP queue) and dispatches them
# either via SMTP (Mail gem) or to a webhook URL. Errors land in a DLQ.

require "rubygems"
require "bundler/setup"

require "json"
require "logger"
require "mail"
require "net/http"
require "openssl"
require "uri"

require_relative "lib/queue"

LOG = Logger.new($stdout)
LOG.level = ENV.fetch("LOG_LEVEL", "info").upcase == "DEBUG" ? Logger::DEBUG : Logger::INFO

SMTP_HOST = ENV.fetch("SMTP_HOST", nil)
SMTP_PORT = ENV.fetch("SMTP_PORT", "587").to_i
SMTP_USER = ENV.fetch("SMTP_USER", nil)
SMTP_PASS = ENV.fetch("SMTP_PASS", nil)
SMTP_FROM = ENV.fetch("SMTP_FROM", "noreply@leetrank.local")
WEBHOOK_URL = ENV.fetch("NOTIFICATION_WEBHOOK_URL", nil)
WEBHOOK_HMAC_SECRET = ENV.fetch("WEBHOOK_HMAC_SECRET", nil)
@hmac_warned = false

if SMTP_HOST
  Mail.defaults do
    delivery_method :smtp,
                    address: SMTP_HOST,
                    port: SMTP_PORT,
                    user_name: SMTP_USER,
                    password: SMTP_PASS,
                    enable_starttls_auto: true
  end
else
  Mail.defaults { delivery_method :test }
end

def deliver(msg)
  if WEBHOOK_URL
    deliver_webhook(msg)
  else
    deliver_email(msg)
  end
end

def deliver_email(msg)
  mail = Mail.new
  mail.from    SMTP_FROM
  mail.to      msg["to"]
  mail.subject msg["subject"].to_s.empty? ? "[LeetRank] #{msg['kind']}" : msg["subject"]
  mail.body    msg["text"].to_s
  mail.deliver!
  LOG.info("notif sent kind=#{msg['kind']} to=#{msg['to']} id=#{msg['id']}")
end

def deliver_webhook(msg)
  uri = URI.parse(WEBHOOK_URL)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == "https")
  http.read_timeout = 10
  http.open_timeout = 5

  body = JSON.generate(msg)
  headers = { "Content-Type" => "application/json" }

  if WEBHOOK_HMAC_SECRET && !WEBHOOK_HMAC_SECRET.empty?
    sig = OpenSSL::HMAC.hexdigest("SHA256", WEBHOOK_HMAC_SECRET, body)
    headers["X-Signature-SHA256"] = sig
  else
    unless @hmac_warned
      LOG.warn("WEBHOOK_HMAC_SECRET unset — webhook delivered without HMAC (dev only)")
      @hmac_warned = true
    end
  end

  req = Net::HTTP::Post.new(uri.request_uri, headers)
  req.body = body
  resp = http.request(req)

  raise "webhook #{resp.code}" unless resp.is_a?(Net::HTTPSuccess)

  LOG.info("notif webhook ok kind=#{msg['kind']} id=#{msg['id']} status=#{resp.code}")
end

LOG.info("notifications worker booting smtp=#{!SMTP_HOST.nil?} webhook=#{!WEBHOOK_URL.nil?}")
queue = NotificationsQueue.new

trap("INT")  { LOG.info("worker: SIGINT — exit");  exit 0 }
trap("TERM") { LOG.info("worker: SIGTERM — exit"); exit 0 }

loop do
  msg = queue.pop_blocking(timeout: 5)
  next if msg.nil?

  begin
    deliver(msg)
  rescue StandardError => e
    LOG.error("worker: deliver failed id=#{msg['id']} err=#{e.class}: #{e.message}")
    queue.push_dlq(msg, error: "#{e.class}: #{e.message}")
  end
end
