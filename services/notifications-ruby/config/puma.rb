workers Integer(ENV.fetch("WEB_CONCURRENCY") { 0 })
threads_count = Integer(ENV.fetch("MAX_THREADS") { 5 })
threads threads_count, threads_count

port        ENV.fetch("PORT") { 4015 }
environment ENV.fetch("RACK_ENV") { "production" }
preload_app!

bind "tcp://0.0.0.0:#{ENV.fetch('PORT', 4015)}"
