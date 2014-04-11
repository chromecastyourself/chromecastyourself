require 'resque'
require 'resque/server'

Resque.redis.namespace = "resque:chromecastyourself_#{Rails.env}"
